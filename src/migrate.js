require('dotenv').config()
const crypto = require('./crypto.js');
const keys = require('./keys.js');
/*const Gun = require('gun');
require('gun/lib/load.js');
require('gun/lib/then.js');
require('gun/lib/radisk.js');
const gundb = Gun()*/
const fs = require('fs');
const storage = require('./hyperdrivestorage.js')
const run = async ipfs => {
  global.ipfs = ipfs;

  ready(ipfs);

};

const ready = async ipfs => {
    /*const paths = crypto.list('state','contracts');
    for(const pindex in paths) {
      const path = paths[pindex].name;
      if(path.startsWith('idx')||path.startsWith('sqlite'))continue;
      const names = hyperdrivestorage.ls(path);
      for(const name in names) {
        if(!names[name].name || !path.length)continue;
        let data = hyperdrivestorage.read(path+'-'+names[name].name);
        if(!data || typeof data != 'object') data = {};
        console.log(data);
        await getPath(path+'-'+names[name].name).put(data).then();
      }
    };*/

    //console.log(await getPath('').map().then());
    const data = JSON.parse(fs.readFileSync('test.json'));
    const recurse = (data, inkey='contracts')=>{
      const values = {};
      let isleaf = true;
      for(const di in data) {
        const value = data[di];
        if(typeof value == 'object') {
          recurse(value, inkey+'/'+di);
          isleaf = false;
        } else {
          values[di]=value;
        }
      }
      if(isleaf) storage.write(inkey, values);

    }
    recurse(data);
    //hyperdrivestorage.gundb.get('contracts').load((data)=>{fs.writeFileSync('test.json', JSON.stringify(data, null, 2));});
};
run (null);
