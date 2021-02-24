const hyperswarm = require('hyperswarm');
const crypto = require('crypto')
const { Packr } = require('msgpackr');
let packr = new Packr();

const swarm = hyperswarm()

// look for peers listed under this topic
const topic = crypto.createHash('sha256').update('chakrachain-blocks').digest()
const id = crypto.createHash('sha256');

swarm.join(topic, { lookup: true, announce: true })

const sockets = {};

exports.broadcast = (msg)=>{
    for(si in sockets) {
        const socket = sockets[si];
        socket.write(packr.pack(msg))
    }
}

swarm.on('connection', (socket, info) => {
  console.log('new connection!', info)
  sockets[id]=socket;
  dropped = info.deduplicate(id, remoteIdBuffer)
  // process.stdin.pipe(socket).pipe(process.stdout)
})

swarm.on('disconnection', (socket, info) => {
  delete sockets[id];
})