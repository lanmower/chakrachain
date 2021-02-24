const crypto = require('./crypto.js');
const pair = crypto.generateKeyPair()

crypto.generateKeyPair(); 
const pub = exports.publicKey = process.env.PUB ? process.env.PUB : Buffer.from(pair.publicKey).toString('hex');
const secret = exports.secretKey = process.env.SECRET ? process.env.SECRET : null;//Buffer.from(pair.secretKey).toString('hex');
console.log({pub});
//console.log({ pub, secret })
