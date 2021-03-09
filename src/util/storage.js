var Hyperdrive = require('hyperdrive')
var drive = new Hyperdrive('./state')
const hyperswarm = require("hyperswarm");
const pump = require('pump')
drive = new Hyperdrive("./state");
drive.ready(() => {
  const swarm = hyperswarm();
  swarm.on("connection", (connection, info) => {
    pump(
      connection,
      drive.replicate({ initiator: info.client }),
      connection
    );
  });
  swarm.join(drive.discoveryKey, {
    announce: true,
    lookup: true
  });
  console.log(drive.version);
  setInterval(()=>{console.log(drive.peers.length)}, 30000)
  console.log(drive.key.toString('hex'));
});

const { Packr } = require('msgpackr');
let packr = new Packr();

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
            if (!err) resolve(list)
            else resolve(list)
        })
    })
}

module.exports = { read, write, ls };