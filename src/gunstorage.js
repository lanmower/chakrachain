const Gun = require('gun');
require('gun/lib/load.js');
require('gun/lib/then.js');
require('gun/lib/radisk.js');

//var server = require('http').createServer().listen(8080);
var gundb = Gun();
//let gundb = Gun({web: server});

const read = (path, gun=gundb) => {
    return new Promise(resolve=>{
        const split = path.split(/[\s/-]+/);
        if (split.length) {
            for (segment in split) {
                gun = gun.get(split[segment])
            }
        }
        return gun.once((res)=>{
            resolve(res);
        });
    })
}
const write = (path, value, gun=gundb) => {
    console.log({path});
    return new Promise(resolve=>{
        const split = path.split(/[\s/-]+/);
        if (split.length) {
            for (segment in split) {
                gun = gun.get(split[segment])
            }
        }
        return gun.put(value, resolve);
    })
}
const ls = (path, gun=gundb) => {
    return new Promise(resolve=>{
        const split = path.split(/[\s/-]+/);
        if (split.length) {
            for (segment in split) {
                gun = gun.get(split[segment])
            }
        }
        return gun.load((data)=>{
            resolve(data);
        });
    })
}


module.exports = { read, write, ls, gundb };
