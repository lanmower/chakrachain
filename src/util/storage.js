const SDK = require('hyper-sdk');
var drive = null;
const { Packr } = require('msgpackr');
let packr = new Packr();

SDK({}).then(sdk=>{
    drive = new sdk.Hyperdrive('chakrachain');
    drive.ready().then(()=>{
        console.log({key:drive.key});
    })
})

const read = (path) => {
    console.log(path);
    return new Promise(resolve => {
        try {
            drive.readFile(path, 'binary', function (err, data) {
                if (!err) resolve(packr.unpack(data));
                else resolve(null)
            })
        } catch (e) {
            resolve(null);
        }
    });
}
const write = (path, value) => {
    return new Promise(resolve => {
        drive.writeFile(path, packr.pack(value), function (err) {
            resolve(err || true);
        });
    })
}
const ls = (path) => {
    return new Promise(resolve => {
        drive.readdir(path, function (err, list) {
            if (!err) resolve(list)
            else resolve(list)
        })
    })
}


const funcs = { read, write, ls };

module.exports = funcs;