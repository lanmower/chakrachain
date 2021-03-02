const hyperdrivestorage = require('../util/storage.js');
var hypercore = require('hypercore')
const { Packr } = require('msgpackr');
let packr = new Packr();
var log = hypercore('./blocklog', { valueEncoding: 'binary' })
var txlog = hypercore('./txlog', { valueEncoding: 'binary' })
const { processTransaction } = require('./transaction.js');
const { TRANSACTION, ERROR, HEIGHT, CALLBACK } = require('../constants/constants.js');

const logGet = (i) => {
    return new Promise(resolve => {
        log.get(i, { timeout: 1000 }, (l, data) => {
            if (data) resolve(packr.unpack(data))
            else resolve(null);
        })
    })
}

exports.createBlock = async (transactionBuffer) => {
    try {
        let block = await logGet(log.length - 1).catch(() => { }) || {};
        const transactions = {};
        if (!block[TRANSACTION]) block[TRANSACTION] = 1;
        if (!block[HEIGHT]) block[HEIGHT] = log.length;

        while (transactionBuffer.length) {
            const tx = transactionBuffer.shift();
            const result = await processTransaction(tx);
            result[TRANSACTION]= tx;

            const callback = tx[CALLBACK];
            delete tx[TRANSACTION];
            try {if(typeof callback=='function') callback(result); } catch (e) { console.error(e) };
            tx[++block[TRANSACTION]] = result;
            
        }
        for (let key in transactions) {
            const transaction = transactions[key];
            if (typeof transaction[TRANSACTION][CALLBACK] == 'function') {
            } else throw new Error('transaction callback must be a function');
        }
        return new Promise(async resolve => {
            block[TRANSACTION] = Object.keys(transactions).filter((key) => { return !transactions[key][ERROR] });
            block[ERROR] = Object.keys(transactions).filter((key) => { return transactions[key][ERROR] });
            console.log(block);
            for (tx of block[TRANSACTION]) {
                for (write in tx[WRITES]) {
                    await hyperdrivestorage.write(write, output[WRITES][write]);
                }
                const output = {};
                output[HEIGHT] = h;
                output[TRANSACTION] = tx;
                await txlog.append(packr.pack(output));
            }

            if (transactions.length) {
                await log.append(packr.pack(block));
                resolve(block);
            }
            else {
                resolve({ msg: 'no tx' });
            }
        });

    } catch (e) {
        console.error(e);
        console.log('BAILED OUT, REVERSED BLOCK!!!')
        transactionBuffer.shift();
        return {};
    }
};
