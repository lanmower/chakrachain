const fs = require("fs");
const crypto = require('./crypto.js');
const hyperdrivestorage = require('./storage.js');
const keys = require('./keys.js');
const { TRANSACTION, PUBLICKEY, CONTRACT, ACTION, INPUT } = require('../constants/constants.js');

exports.update = async (transactionBuffer) => {
    const code = fs.readFileSync('src/contracts/tokens.js').toString();
    const read = (await hyperdrivestorage.read(`contracts-${keys.publicKey}-current`)).code;
    const tx = {};
    tx[CONTRACT]=keys.publicKey;
    tx[ACTION]='setContract';
    tx[INPUT]=code
    const transaction = crypto.sign(tx, keys.secretKey);
    if (!read || read != code) {
        const out = {};
        out[TRANSACTION] = transaction;
        out[PUBLICKEY] = keys.publicKey;
        transactionBuffer.push(out);
    }
}
