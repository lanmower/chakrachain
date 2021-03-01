const hyperdrivestorage = require('../util/storage.js');
var hypercore = require('hypercore')
const { Packr } = require('msgpackr');
let packr = new Packr();
var log = hypercore('./blocklog', {valueEncoding: 'binary'})
const {processTransaction} = require('./transaction.js');

const logGet = (i)=>{
    return new Promise(resolve=>{
        log.get(i, {timeout:1000},(l, d)=>{
            if(d) resolve(packr.unpack(d))
            else resolve(null);
        })
    })
}

exports.createBlock = async (transactionBuffer) => {
    try {
        let block = await logGet(log.length-1).catch(()=>{})||{};
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
            transactions[++block.tx]={ tx, simtime, finaltime, result, error };
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
        return new Promise(async resolve => {
            const txcount = Object.keys(transactions).filter((key)=>{return !transactions[key].error}).length;
            if (txcount) {
                await log.append(packr.pack(block));
                calls();
                resolve(block);
            }
            else {
                calls();
                resolve({ msg:'no tx' });
            }
        });

    } catch (e) {
        console.error(e);
        console.log('BAILED OUT, REVERSED BLOCK!!!')
        transactionBuffer.shift();
        return {  };
    }
};
