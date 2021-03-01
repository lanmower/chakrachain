const fs = require("fs");
const crypto = require('./crypto.js');
const hyperdrivestorage = require('./storage.js');
const keys = require('./keys.js');

const update = async () => {
    const code = fs.readFileSync('../contracts/tokens.js').toString();
    const read = (await hyperdrivestorage.read(`contracts-${keys.publicKey}-current`)).code;
    const transaction = crypto.sign({
        contract: keys.publicKey,
        action: 'setContract',
        sender: '',
        payload: code
    }, keys.secretKey);
    if (!read || read != code) {
        transactionBuffer.push({ transaction, account: keys.publicKey, publicKey: keys.publicKey });
    }
}
if (process.env.TOKENPUBLISH) update();