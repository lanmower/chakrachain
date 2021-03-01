const { BigNumber } = require("bignumber.js");
const { VM, VMScript } = require("vm2");
const validator = require("validator");
const crypto = require('../util/crypto.js');
const {getCache,setCache} = require('../util/cache.js');
const hyperdrivestorage = require('../util/storage.js');
exports.processTransaction = async (input) => {
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
        timeout: 1000
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
