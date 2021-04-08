const { BigNumber } = require("bignumber.js");
const { VM, VMScript } = require("vm2");
const validator = require("validator");
const crypto = require('../util/crypto.js');
const { getCache, setCache } = require('../util/cache.js');
const storage = require('../util/storage.js');
const { ERROR, OUTPUT, WRITES, TIME, TRANSACTION, PUBLICKEY, CONTRACT, INPUT, ACTION, SENDER } = require('../constants/constants.js');//

const verify = (input) => {
    let tx = crypto.verify(input[TRANSACTION], input[PUBLICKEY]);
    if (!tx) throw new Error('Transaction from ' + input[PUBLICKEY] + ' not verified');
    if (tx instanceof Map) tx = Object.fromEntries(tx);
    return tx;
}
const parseSrc = (src) => {
    let codetext = `
    RegExp.prototype.constructor = function () { };RegExp.prototype.exec = function () {  };RegExp.prototype.test = function () {  }; const construct = api.transaction['${ACTION}']!='setContract'?${src.code}:()=>{}
    try { let actions = construct();
        (async()=>{
            if (api.transaction['${ACTION}'] == 'setContract') {
                const time = new Date().getTime();
                const output = await api.write('current', { code: api.transaction['${INPUT}'] });
                done(null, api['${WRITES}']);
            } else {
                if(!(api.transaction['${ACTION}'] && typeof api.transaction['${ACTION}'] === 'string' && typeof actions[api.transaction['${ACTION}']] === 'function')) throw new Error('invalid action:'+api.transaction['${ACTION}']);
                try {
                    await actions[api.transaction['${ACTION}']](api.transaction['${INPUT}'])
                    done(null, api['${WRITES}']);
                } catch(e) {
                    console.error(e);
                    done(e, null);
                }
            }
        })()
    } catch(e) {console.error(e)}
    `;
    return new VMScript(codetext);
}
const getApi = (transaction, publicKey) => {
    const sender = transaction[SENDER];
    const contract = transaction[CONTRACT];
    const api = {
        assert: (check, msg) => {
            if (Array.isArray(check)) {
                for (let c of check) {
                    if (!c[0]) throw new Error(c[1]);
                }
            }
            if (!check) throw new Error(msg);
        },
        read: async (path) => {
            api.reads++;
            if (api.writes && api.writes[path]) {
                return api.writes[path];
            }
            const read = await storage.read(`contracts/${contract}/${path}`);
            return read;
        },
        write: async  (path, input) => {
            return api.writes[`contracts/${contract}/${path}`] = input;
        },
        reads: 0,
        writes: {},
        sender,
        publicKey,
        contract,
        BigNumber,
        validator,
        transaction,
        emit: () => { }
    }
    return api;
}

exports.processTransaction = async (input) => {
    const tx = verify(input);
    console.log({tx})
    const contract = tx[CONTRACT];
    console.log({contract});
    await setCache(`contracts/${contract}/current`, 'code', parseSrc);

    const api = getApi(tx, input[PUBLICKEY]);
    const vm = new VM({
        timeout: 1000
    });
    const time = new Date().getTime();
    const writes = api.writes;

    return await new Promise(async (resolve) => {
        vm._context.done = (error, result) => {
            const output = {};
            output[ERROR] = error;
            output[OUTPUT] = result;
            output[WRITES] = writes;
            output[TIME] = new Date().getTime() - time
            output[TRANSACTION] = input;
            resolve(output);
        }
        vm._context.api = api;
        vm._context.console = console;
        console.log('running VM')
        try {
            vm.run(getCache('code', `contracts/${contract}/current`));
        } catch (error) {
            console.error(error);
            const result = {};
            result[ERROR] = error;
            result[TIME] = new Date().getTime() - time;
            resolve(result);
        }
    })
};
