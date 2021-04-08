const storage = require('../util/storage.js');
var core = require('hypercore')
const { Packr } = require('msgpackr');
let packr = new Packr();
var log = core('./blocklog', { valueEncoding: 'binary' })
var txlog = core('./txlog', { valueEncoding: 'binary' })
const transactionBuffer = exports.transactionBuffer = [];
const { processTransaction } = require('./transaction.js');
const { TRANSACTION, ERROR, HEIGHT, CALLBACK, WRITES, TRANSACTIONS } = require('../constants/constants.js');

const pubsub = exports.pubsub = require("../util/pubsub.js").server('chakrachain');


pubsub.on('tx', (t, cb) => {
    t[CALLBACK] = cb;
    transactionBuffer.push(t);
});

const logGet = (i) => {
    return new Promise(resolve => {
        log.get(i, { timeout: 1000 }, (l, data) => {
            if (data) resolve(packr.unpack(data))
            else resolve(null);
        })
    })
}

const createBlock = exports.createBlock = async (transactionBuffer) => {
    try {
        let block = await logGet(log.length - 1).catch(() => { }) || {};
        delete block.transaction;
        block[TRANSACTION] = txlog.length;
        block[HEIGHT] = log.length;
        block[TRANSACTIONS] = [];
        block[ERROR] = [];
        while (transactionBuffer.length) {
            const tx = transactionBuffer.shift();
            const result = await processTransaction(tx);
            try {
                if (typeof tx[CALLBACK] == 'function') tx[CALLBACK](result);
            } catch (e) { console.error(e) };
            delete tx[CALLBACK];
            if (!result[ERROR]) block[TRANSACTIONS].push(result);
            else block[ERROR].push(result);
        }
        return new Promise(async resolve => {
            for (h in Object.keys(block[TRANSACTIONS])) {
                const output = {};
                const tx = block[TRANSACTIONS][h];
                for (write in tx[WRITES]) {
                    await storage.write(write, tx[WRITES][write]);
                }
                output[HEIGHT] = txlog.length;
                output[TRANSACTION] = tx;
                txlog.append(packr.pack(output));
            }
            if (block[TRANSACTIONS].length) {
                log.append(packr.pack(block));
                console.log('done processing ', block)
                block.log = log.key;
                block.txlog = txlog.key;
                pubsub.emit("block", block);
                resolve(block);
            }
            else {
                console.log('no tx', block);
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

let running;
setInterval(async () => {
    if (running) return;
    running = true;
    if (transactionBuffer.length) {
        try {
            await createBlock(transactionBuffer);
        } catch (e) {
            console.error("error creating block", e);
        }
    }
    running = false;
}, 250);
