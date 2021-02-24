var Hyperdrive = require('hyperdrive')
var drive = new Hyperdrive('./state')
const { Packr } = require('msgpackr');
let packr = new Packr();

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

const read = (p) => {
    path = p.replaceAll('-', '/');
    return new Promise(resolve => {
        try {
            drive.readFile(path, 'binary', function (err, data) {
                if (!err) resolve(packr.unpack(data));
                else resolve(null)
            })
        } catch (e) {

        }
    });
}
const write = (p, value) => {
    path = p.replaceAll('-', '/');
    return new Promise(resolve => {
        drive.writeFile(path, packr.pack(value), function (err) {
            resolve(err || true);
        });
    })
}
const ls = (p) => {
    path = p.replaceAll('-', '/');
    return new Promise(resolve => {
        drive.readdir(path, function (err, list) {
            console.log(list)
            if (!err) resolve(list)
            else resolve(list)
        })
    })
}

module.exports = { read, write, ls };