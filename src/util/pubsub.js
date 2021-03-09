const hyperswarm = require("hyperswarm");
const crypto = require("crypto");
const { Packr } = require("msgpackr");
let packr = new Packr();

const getId = topic => {
  return crypto
    .createHash("sha256")
    .update(topic || new Date().getTime().toString())
    .digest();
};

function server(tstring) {
  const topic = crypto
    .createHash("sha256")
    .update(tstring)
    .digest();
    console.log(tstring, topic.toString('hex'))
  const localId = getId(crypto.randomBytes(30));
  const swarm = hyperswarm();
  swarm.join(topic, {
    lookup: true,
    announce: true
  });
  const funcmap = {};
  const sockets = [];
  swarm.on("connection", (socket, info) => {
    socket.write(packr.pack({ id: localId.toString(), e: "r" }));
    socket.on("data", async bytes => {
      try {
        const data = packr.unpack(bytes);
        switch (data.e) {
          case "r":
            if (info.deduplicate(localId, Buffer.from(data.id, "binary"))) break;
            sockets.push(socket);
            break;
          case "e":
            const { a, p } = data;
            if(typeof funcmap[a] == 'function')funcmap[a](p);
            break;
        }
      } catch (e) {
        console.error(e);
      }
    });
  });
  swarm.listen();

  return {
    on: (action, func) => {
      funcmap[action] = func;
    },
    emit: async (action, payload) => {
      const send = {
        id: localId.toString(),
        e: "e",
        a: action,
        p: payload
      };
      for (const socket of sockets) {
        setTimeout(() => {
          try {
            socket.write(packr.pack(send));
          } catch (e) {}
        }, 0);
      }
    }
  };
}
module.exports = server;
