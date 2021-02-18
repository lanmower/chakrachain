const { BigNumber } = require("bignumber.js");
const { VM, VMScript } = require("vm2");
const validator = require("validator");
const crypto = require('./crypto.js');
const keys = require('./keys.js')
const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');
const topic = 'REPLACE_WITH_GENESIS';
const { Packr } = require('msgpackr');

let packr = new Packr({ structuredClone: true });

const cache = {
}

setCache = async (p, name, before = d => d) => {
    cache[name] = cache[name] || {};
    const update = async () => {
        let src = await crypto.read(p);
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

processTransaction = async (input, simulation) => {
    const t = crypto.verify(input.transaction, input.publicKey);
    let transaction = t instanceof Map?transcation = Object.fromEntries(t):t;


    if(!transaction) throw new Error('Transaction from '+input.publicKey+' not verified');
    const { contract, sender, action } = transaction;
    if (action == 'setContract') {
        const time = new Date().getTime();
        const output = await crypto.write(`/data/contracts/${input.publicKey}/current`, { code: transaction.payload });
        return { error: null, result: output, time: new Date().getTime() - time }
    }
    const parseSrc = (src) => {
        let codetext = `
        RegExp.prototype.constructor = function () { };RegExp.prototype.exec = function () {  };RegExp.prototype.test = function () {  }; const construct = ${src.code};
        let actions = construct();  
        if(!(api.action && typeof api.action === 'string' && typeof actions[api.action] === 'function')) throw new Error('invalid action:'+api.action);
        try {
            done(null, actions[api.action](api.transaction.payload));
        } catch(e) {
            done(e, null);
            console.error(e);
        }
        `;
        return new VMScript(codetext)
    }
    await setCache(`/data/contracts/${contract}/current`, 'code', parseSrc);
    let api = {
        assert: (crit, msg) => {
            if (Array.isArray(crit)) {
                for (let c of crit) {
                    if (!c[0]) throw new Error(c[1]);
                }
            }
            if (!crit) throw new Error(msg);
        },
        read: (p) => {
            api.reads++;
            if (api.simulation && api.simwrites && api.simwrites[p]) {
                return api.simwrites[p];
            }
            const output = crypto.read(`/data/contracts/${contract}/${p}`);
            return output;
        },
        clear: async (p) => {
            const output = await crypto.clear(`/data/contracts/${contract}/${p}`);
            return output;
        },
        write: (p, input) => {
            if (api.simulation) {
                if (!api.simwrites) api.simwrites = {};
                api.simwrites[p] = input;
                return null;
            }
            api.writes++;
            return output = crypto.write(`/data/contracts/${contract}/${p}`, input);
        },
        writes: 0,
        reads: 0,
        simulation,
        simwrites: {},
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
        timeout: 1000,
        fixAsync: true
    });
    const time = new Date().getTime();
    return await new Promise(async (resolve) => {
        vm._context.done = (error, result) => {
            resolve({ error, result, time: new Date().getTime() - time });
        }
        vm._context.api = api;
        vm._context.console = console;
        try {
            vm.run(getCache('code', `/data/contracts/${contract}/current`));
        } catch (e) {
            console.error(e);
            resolve({ e, result, time: new Date().getTime() - time });
        }
    })
};

exports.createBlock = async (ipfs, transactionBuffer) => {
    //fse.copySync('/data', './block');
    let parentcid = null;
    const file = fs.readFileSync('data/state.db');
    parentcid = (await ipfs.add(file), { pin: true }).cid;
    try {
        let data = await crypto.read("/data/block/info/metadata");
        if (!data) {
            data = { height: 1 };
            await crypto.write("/data/accounts/" + keys.publicKey, {}, {
                create: true,
                parents: true
            });
        }
        const transactions = [];

        while (transactionBuffer.length) {
            const data = transactionBuffer.shift();

            let result, error;
            const output = await processTransaction(data, true);
            let simtime = output.time;
            if (!output.error) {
                try {
                    const output = await processTransaction(data, false);
                    result = output.result;
                    error = output.error;
                    finaltime = output.time;
                    transactions.push({ payload:data, simtime, finaltime, result, error });
                } catch (e) {
                    console.error(e);
                }
            } else {
                result = output.result;
                error = output.error;
                finaltime = output.finaltime;
                transactions.push({ payload:data, simtime, finaltime: 0, result, error });
            }
        }
        data.height++;
        if (parentcid) data.parentcid = parentcid.toString();
        const callbacks = [];
        for (let transaction of transactions) {
            if (transaction.payload.callback) {
                const callback = transaction.payload.callback;
                callbacks.push((cid) => { callback(transaction.error, transaction.result, { simtime: transaction.simtime, finaltime: transaction.finaltime }, data, cid) });
                delete transaction.payload.callback;
            }
        }

        const calls = async (newcid) => {
            for (let callback of callbacks) {
                try {
                    await callback(newcid);
                } catch (e) { console.error(e) }
            }
        }
        return new Promise(async resolve => {
            if (transactions.filter(t => !t.error).length) {
                await crypto.write("/data/block/info/transactions", transactions, {
                    create: true,
                    parents: true
                });
                await crypto.write("/data/block/info/metadata", data, {
                    create: true,
                    parents: true
                }, keys);
                let parentcid = null;
                const file = fs.readFileSync('data/state.db');
                parentcid = (await ipfs.add(file, { pin: true })).cid;
                ipfs.pubsub.publish('chakrachain-blocks', packr.pack({cid:parentcid.toString(), height:data.height}));
                calls(parentcid);
                
                resolve(`Block ${data.height} creation complete.`);
            }
            else {
                //fse.copySync('./block', '/data');
                calls(parentcid);
                resolve({ parentcid });
            }
        });

    } catch (e) {
        //fse.copySync('./block', '/data');
        console.error(e);
        console.log('BAILED OUT, REVERSED BLOCK!!!')
        transactionBuffer.shift();
        return { newcid: parentcid };
    }
};
