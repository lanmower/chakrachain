const { Packr } = require('msgpackr');
let packr = new Packr();
let storage = require('./storage.js').init;
const stores = {};
exports.oldRead = async (files, p) => {
  const chunks = [];
  for await (const chunk of files.read(p)) {
    chunks.push(chunk);
  }
  return packr.unpack(Buffer.concat(chunks));
};
exports.oldWrite = async (files, p, input) => {
  return await files.write(p, packr.pack(input), {
    create: true,
    parents: true,
    truncate: true,
    flush: true
  });
};

exports.read = (p) => {
  const split = p.split('/');
  const key = split.pop();
  let name = split.join('-').replace('.','').replace('data','').replace('-','');
  if(name.startsWith('-')) name = name.replace('-','')
 const path = './data/state';
  let store = stores[name]
  if(!store) store = stores[name] = storage(path, name);
  const read = store.read(key);
  if(read) return packr.unpack(read.value);
  else throw new Error('not read');
};

exports.ls = (p) => {
  const split = p.split('/');
  let name = split.join('-').replace('.','').replace('data','').replace('-','');
  if(name.startsWith('-')) name = name.replace('-','')
  const path = './data/state';
  let store = stores[name]
  if(!store) store = stores[name] = storage(path, name);
  const read = store.ls();
  return read;
}

exports.clear = (p) => {
  const split = p.split('/');
  let name = split.join('-').replace('.','').replace('data','').replace('-','');
  if(name.startsWith('-')) name = name.replace('-','')
  const path = './data/state';
  let store = stores[name]
  if(!store) store = stores[name] = storage(path, name);
  const read = store.clear();
  return read;
}
exports.write = (p, input) => {
  const split = p.split('/');
  const key = split.pop();
  let name = split.join('-').replace('.','').replace('data','').replace('-','');
  if(name.startsWith('-')) name = name.replace('-','')
  const path = './data/state';
  let store = stores[name]
  if(!store) store = stores[name] = storage(path, name);
  const ret = store.write(key, packr.pack(input));
  return ret;
};

exports.close = () =>{
  //console.log('io close');
  for(const store in stores) {
    //console.log('closing', store);
    stores[store].close()
    delete stores[store]
  }
}