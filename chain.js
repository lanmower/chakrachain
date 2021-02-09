const { BigNumber } = require("bignumber.js");
const { VM, VMScript } = require("vm2");
const validator = require("validator");
const all = require("it-all");
const crypto = require('./crypto.js');
const keys = require('./keys.js')

const cache = {
}

setCache = async (p, name, before = d => d) => {
    cache[name] = cache[name] || {};
    const update = async () => {
        let src = await all(ipfs.cat(p));
        return {
            time: new Date().getTime(),
            value: before(src)
        };
    }
    if (!cache[name][p]) {
        cache[name][p] = await update();
    }
}
getCache = (name, p) => cache[name][p].value;

processTransaction = async (ipfs, input, simulation) => {
    const root = "data";
    const transaction = crypto.verify(input.transaction, keys.publicKey);
    const parseSrc = (src) => {
        let codetext = `
        RegExp.prototype.constructor = function () { };RegExp.prototype.exec = function () {  };RegExp.prototype.test = function () {  };const construct = ${src};
        let actions = construct();  
        api.assert(api.action && typeof api.action === 'string' && typeof actions[api.action] === 'function', 'invalid action');
        actions[api.action](api.transaction.payload).then((out)=>{done(null, out)}).catch((e)=>{done(e); console.error(e)})
        `;
        return new VMScript(codetext)
    }
    await setCache(`/ipfs/${transaction.codecid}`, 'code', parseSrc);
    let api = {
        mkdir: async path => {
            api.writes++;
            if (!api.simluation) return await ipfs.files.mkdir(`/data/${transaction.contract}/${path}`);
            else return null;
        },
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
            const output = await crypto.read(ipfs, `/data/contracts/${transaction.contract}/${p}`);
            return output;
        },
        write: async (p, input) => {
            if (api.simulation) {
                return null;
            }
            api.writes++;
            return output = await crypto.write(ipfs, `/data/contracts/${transaction.contract}/${p}`, input);
        },
        writes: 0,
        reads: 0,
        simulate: true,
        sender: transaction.sender,
        BigNumber,
        validator,
        action: transaction.action,
        transaction,
        emit: () => { }
    };
    const vm = new VM({
        timeout: 1000
    });
    const time = new Date().getTime();
    return await new Promise(async (resolve) => {
        vm._context.done = (error, result) => {
            resolve({ error, result, time: new Date().getTime() - time });
        }
        api.simulation = simulation;
        vm._context.api = api;
        vm._context.console = console;
        vm.run(getCache('code', `/ipfs/${transaction.codecid}`));
    })
};

exports.createBlock = async (ipfs, transactionBuffer) => {
    let parentcid
    try {
        parentcid = (await ipfs.files.stat("/data")).cid;
        ipfs.pin.add('/ipfs/' + parentcid);
    } catch (e) {
        await ipfs.files.mkdir("/data", { parents: true });
    }
    try {
        data = await crypto.read(ipfs, "/data/block");
        if (!data) {
            data = { height: 1 };
            await crypto.write(ipfs, "/data/accounts/" + keys.publicKey, {}, {
                create: true,
                parents: true
            });
        }
        const transactions = [];
        while (transactionBuffer.length) {
            const transaction = transactionBuffer.shift();
            let result, error;
            const output = await processTransaction(ipfs, transaction, true);
            let simtime = output.time;
            if (!output.error) {
                try {
                    const output = await processTransaction(ipfs, transaction, false);
                    result = output.result;
                    error = output.error;
                    finaltime = output.time;
                    transactions.push({ transaction, simtime, finaltime, result, error });
                } catch (e) {
                    console.error(e);
                }
            } else {
                result = output.result;
                error = output.error;
                finaltime = output.ltime;

                transactions.push({ transaction, simtime, finaltime: 0, result, error });
            }
        }
        data.height++;
        if(parentcid) data.parentcid = parentcid.toString();
        const callbacks = [];
        for (let transaction of transactions) {
            if(transaction.transaction.callback) {
                const callback = transaction.transaction.callback;
                callbacks.push((cid)=>{callback(transaction.error, transaction.result, { simtime: transaction.simtime, finaltime: transaction.finaltime }, data, cid)});
                delete transaction.transaction.callback;
            }
        }

        const calls = async (newcid)=>{
                for (let callback of callbacks) {
                    try {
                        await callback(newcid);
                    } catch (e) { console.error(e) }
                }
        }   
        return new Promise(async resolve => {
            if (transactions.filter(t => !t.error).length) {
                await crypto.write(ipfs, "/data/transactions", transactions, {
                    create: true,
                    parents: true
                });
                await crypto.write(ipfs, "/data/block", data, {
                    create: true,
                    parents: true
                }, keys);
                const newcid = (await ipfs.files.stat("/data")).cid;
                if (newcid) ipfs.pin.add('/ipfs/' + newcid);
                
                calls(newcid);
                resolve({ transactions, newcid });
            }
            else {
                if (parentcid) {
                    await ipfs.files.rm("/data", { recursive: true });
                    await ipfs.files.cp("/ipfs/" + parentcid.toString(), "/data", {
                        create: true
                    });
                }
                calls(newcid);
                resolve({ parentcid });
            }
        });

    } catch (e) {
        if (parentcid) {
            await ipfs.files.rm("/data", { recursive: true });
            await ipfs.files.cp("/ipfs/" + parentcid.toString(), "/data", {
                create: true
            });
        }
        console.error(e);
        console.log('BAILED OUT, REVERSED BLOCK!!!')
        transactionBuffer.shift();
        return { newcid: parentcid };
    }
};
