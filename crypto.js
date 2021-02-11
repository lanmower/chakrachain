const { sign } = require('tweetnacl');
exports.generateKeyPair = () => sign.keyPair()
const keys = require('./keys.js')
const { read, write } = require('./io.js');
const util = require('tweetnacl-util');
exports.util = util;
const {
  decodeUTF8,
  encodeUTF8,
  encodeBase64,
  decodeBase64
} = require("tweetnacl-util");
const { Packr } = require('msgpackr');
let packr = new Packr({ structuredClone: true });

const lsign = exports.sign = (obj, key) => {
  const keyUint8Array =  new Uint8Array(Buffer.from(key, 'hex'));
  const packed = packr.pack(obj);
  const messageUint8 = new Uint8Array(packed);
  const box =  sign(messageUint8, keyUint8Array);
  return box;
};

const lverify = exports.verify = (msg, key) => {
  if(msg == null) throw new Error('Cannot verify null message');
  if(key == null) throw new Error('Cannot verify null key');
  const keyUint8Array = new Uint8Array(Buffer.from(key, 'hex'));
  const messageAsUint8Array = msg;
  const outputUint8Array = sign.open(messageAsUint8Array, keyUint8Array);
  if(!outputUint8Array) throw new Error('Couldnt unpack data with key:', key);
  return packr.unpack(outputUint8Array);
};


exports.read = async (ipfs, p) => {
  try { 
    const r = await read(ipfs, p);
    if(!r) return null;
    const { data, account } = r;
    if(!data || !account) return null;
    return lverify(data, account)
  } catch(e) {
    console.log('READ ERROR');
    console.error(e);
    return null;

  }
};

exports.write = async (ipfs, p, input, options, keypair=keys) => {
  const data = await lsign(input, keypair.secretKey)
  return await write(ipfs, p, { data, account:keypair.publicKey}, options);
};

