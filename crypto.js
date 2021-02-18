const { sign } = require('tweetnacl');
exports.generateKeyPair = () => sign.keyPair()
const keys = require('./keys.js')
const { read, write,ls,oldRead, oldWrite, close, clear } = require('./io.js');
const util = require('tweetnacl-util');
exports.util = util;
const { Packr } = require('msgpackr');
let packr = new Packr({ structuredClone: true });
const lsign = exports.sign = (obj, key) => {
  const keyUint8Array =  new Uint8Array(Buffer.from(key, 'hex'));
  const packed = packr.pack(obj);
  const messageUint8 = new Uint8Array(packed);
  const box =  sign(messageUint8, keyUint8Array);
  return box;
};

exports.clear = (p)=>{
  return clear(p);
}

const lverify = exports.verify = (msg, key) => {
  if(msg == null) throw new Error('Cannot verify null message');
  if(key == null) throw new Error('Cannot verify null key');
  const keyUint8Array = new Uint8Array(Buffer.from(key, 'hex'));
  const messageAsUint8Array = msg;
  const outputUint8Array = sign.open(messageAsUint8Array, keyUint8Array);
  if(!outputUint8Array) throw new Error('Couldnt unpack data with key:', key);
  return packr.unpack(outputUint8Array);
};


exports.read = (p) => {
  try { 
    const r = read(p);
    return r;
    if(!r) return null;
    const { data, account } = r;
    if(!data || !account) return null;
    return lverify(data, account)
  } catch(e) {
    console.log('READ ERROR',e.message);
    return null;
  }
};

exports.write = (p, input, options, keypair=keys) => {
//  console.log('writing', p)
  //const data = lsign(input, keypair.secretKey)
  return write(p, input);
};

exports.ls = (p) =>{
  return ls(p);
}

exports.oldRead = async (ipfs, p) => {
  try { 
    const r = await oldRead(ipfs.files, p);
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

exports.oldWrite = async (ipfs, p, input, options, keypair=keys) => {
  const data = await lsign(input, keypair.secretKey)
  return await oldWrite(ipfs.files, p, { data, account:keypair.publicKey}, options);
};

exports.close = ()=>{
  console.log('crypto close')
  close();
}

