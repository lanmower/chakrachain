const { sign } = require('tweetnacl');
exports.generateKeyPair = () => sign.keyPair()
const util = require('tweetnacl-util');
exports.util = util;
const { Packr } = require('msgpackr');
let packr = new Packr();

exports.sign = (obj, key) => {
  const keyUint8Array =  new Uint8Array(Buffer.from(key, 'hex'));
  const packed = packr.pack(obj);
  const messageUint8 = new Uint8Array(packed);
  const box = sign(messageUint8, keyUint8Array);
  return Buffer.from(box).toString('binary');
};

exports.verify = (msg, key) => {
  if(msg == null) throw new Error('Cannot verify null message');
  if(key == null) throw new Error('Cannot verify null key');
  const keyUint8Array = new Uint8Array(Buffer.from(key, 'hex'));
  const messageAsUint8Array = new Uint8Array(Buffer.from(msg, 'binary'));
  const outputUint8Array = sign.open(messageAsUint8Array, keyUint8Array);
  if(!outputUint8Array) throw new Error('Couldnt unpack data with key:', key);
  return packr.unpack(outputUint8Array);
};

