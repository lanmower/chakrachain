const { BigNumber } = require("bignumber.js");
const { VM, VMScript } = require("vm2");
const validator = require("validator");
const crypto = require('./crypto.js');
const keys = require('./keys.js')
const hyperdrivestorage = require('./hyperdrivestorage.js');
var hypercore = require('hypercore')
const { Packr } = require('msgpackr');
let packr = new Packr();
var log = hypercore('./blocklog', {valueEncoding: 'binary'})

const pubsub = exports.pubsub = require("./hyperpubsub.js")('chakrachain');

const cache = {
}

setCache = async (p, name, before = d => d) => {
    cache[name] = cache[name] || {};
    const update = async () => {
        let src = await hyperdrivestorage.read(p);
        return {
            time: new Date().getTime(),
            value: before(src)
        };
    }
    if (!cache[name][p]) {
        cache[name][p] = await update();
    }
}
getCache = (name, p) => {
    return cache[name][p].value;
}

processTransaction = async (input) => {
    let transaction = crypto.verify(input.transaction, input.publicKey);

    if(!transaction) throw new Error('Transaction from '+input.publicKey+' not verified');
    if(transaction instanceof Map) transaction = Object.fromEntries(transaction);
    const { contract, sender, action } = transaction;
    const parseSrc = (src) => {
        let codetext = `
        RegExp.prototype.constructor = function () { };RegExp.prototype.exec = function () {  };RegExp.prototype.test = function () {  }; const construct = ${src.code}
        let actions = construct();  
        run = async() => {
            if (api.action == 'setContract') {
                const time = new Date().getTime();
                const output = await api.write('current', { code: api.transaction.payload });
                done(null, api.writes);
            } else {
                if(!(api.action && typeof api.action === 'string' && typeof actions[api.action] === 'function')) throw new Error('invalid action:'+api.action);
                try {
                    console.log('running action');
                    await actions[api.action](api.transaction.payload)
                    done(null, api.writes);
                    console.log('ran action');
                } catch(e) {
                    console.log('failed action');
                    console.error(e);
                    done(e, null);
                }
            }
        }
        run();
        `;
        return new VMScript(codetext)
    }
    await setCache(`contracts-${contract}-current`, 'code', parseSrc);
    let api = {
        assert: (crit, msg) => {
            if (Array.isArray(crit)) {
                for (let c of crit) {
                    if (!c[0]) throw new Error(c[1]);
                }
            }
            if (!crit) throw new Error(msg);
        },
        read: async (p) => {
            api.reads++;
            if (api.writes && api.writes[p]) {
                return api.writes[p];
            }
            const read = await hyperdrivestorage.read(`contracts-${contract}-${p}`);
            return read;
        },
        /*clear: async (p) => {
            const output = await storage.clear(`contracts-${contract}-${p}`);
            return output;
        },*/
        write: async (p, input) => {
            if (!api.writes) api.writes = {};
            return api.writes[`contracts-${contract}-${p}`] = input;
        },
        reads: 0,
        writes: {},
        sender,
        publicKey:input.publicKey,
        contract:contract,
        BigNumber,
        validator,
        action,
        transaction,
        emit: () => { }
    };
    const vm = new VM({
        timeout: 1000//,
        //fixAsync: true
    });
    const time = new Date().getTime();
    const writes = api.writes;
    return await new Promise(async (resolve) => {
        vm._context.done = (error, result) => {
            resolve({ error, result, writes, time: new Date().getTime() - time });
        }
        vm._context.api = api;
        vm._context.console = console;
        try {
            vm.run(getCache('code', `contracts-${contract}-current`));
        } catch (e) {
            console.error(e);
            resolve({ e, time: new Date().getTime() - time });
        }
    })
};

const logGet = (i)=>{
    return new Promise(resolve=>{
        console.log(i);
        log.get(i, {timeout:100},(l, d)=>{
            console.log(l)
            if(d) resolve(packr.unpack(d))
            else resolve(null);
        })
    })
}

exports.createBlock = async (ipfs, transactionBuffer) => {
    try {
        let block = await logGet(log.length-1).catch(()=>{})||{};
        console.log(block)
        const transactions = {};
        if(!block.tx) block.tx=1;
        if(!block.h) block.h=log.length;

        while (transactionBuffer.length) {
            const tx = transactionBuffer.shift();

            let result, error;

            const output = await processTransaction(tx);
            if(output.error == null) {
                for(write in output.writes) {
                    await hyperdrivestorage.write(write, output.writes[write]);
                }
            }
            let simtime = output.time;
            result = output.result;
            error = output.error;
            finaltime = output.time;
            transactions[block.tx++]={ tx, simtime, finaltime, result, error };
        }
        const callbacks = [];
        for (let key in transactions) {
            const transaction = transactions[key];
            if (transaction.tx.callback) {
                const callback = transaction.tx.callback;
                callbacks.push(() => { callback(transaction.error, transaction.result, { simtime: transaction.simtime, finaltime: transaction.finaltime }, block) });
                delete transaction.tx.callback;
            }
        }
        block.transaction = transactions;
        const calls = async () => {
            for (let callback of callbacks) {
                try {
                    await callback();
                } catch (e) { console.error(e) }
            }
        }
        //actions[api.action](api.transaction.payload)=
        return new Promise(async resolve => {
            const txcount = Object.keys(transactions).filter((key)=>{return !transactions[key].error}).length;
            if (txcount) {
                await log.append(packr.pack(block));
                pubsub.emit('block', block);
                calls();
                resolve(`Block ${block.h} creation complete.`);
            }
            else {
                calls();
                resolve({ msg:'no tx' });
            }
        });

    } catch (e) {
        //fse.copySync('./block', '/data');
        console.error(e);
        console.log('BAILED OUT, REVERSED BLOCK!!!')
        transactionBuffer.shift();
        return {  };
    }
};
