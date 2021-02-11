require('dotenv').config()
const express = require("express");
const fs = require("fs");
const app = express();
const all = require("it-all");
const IPFS = require("ipfs-core");
const Discord = require("discord.js");
let client;
if (process.env.DISCORD) client = new Discord.Client();
const { actions } = require("./actions.js");
const { createBlock } = require('./chain.js');
const crypto = require('./crypto.js');
const keys = require('./keys.js');
const { Packr } = require('msgpackr');
const topic = 'REPLACE_WITH_GENESIS';

let packr = new Packr({ structuredClone: true });

if (client) client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});
app.post("/hook", (req, res) => {
  console.log(req.body);
  res.status(200).end();
})

if (client) client.login(process.env.DISCORD);

const listen = app.listen(1337, () => {
  console.log("Your app is listening on port " + listen.address().port);
});

const run = async ipfs => {
  global.ipfs = ipfs;

  ready(ipfs);

  //await ipfs.add(fs.readFileSync("./explorer.html"))
  //const explorer = (await ipfs.add(fs.readFileSync("./explorer.html"))).cid;
  //try {await ipfs.files.rm('/data/explorer.html');} catch (e) {}
  //await ipfs.files.cp('/ipfs/' + explorer.toString(), '/data/explorer.html', { parents: true });

  app.use("/delete", (req, res) => {
    ipfs.files.rm("/data", { recursive: true });
    res.send('done');
  });
  app.use("request", async function (req, res) {
    try {
      let src = await all(req.query.cid);
      res.send(src);
    } catch (e) {
      console.error(e);
    }
  });
};


const ready = async ipfs => {
  const transactionBuffer = [];
  let running = false;
  const code = fs.readFileSync('./tokens.js').toString();
  const read = await crypto.read(ipfs, `/data/contracts/${keys.publicKey}/current`);

  if (keys.secretKey) {
    const transaction = crypto.sign({
      contract: keys.publicKey,
      action: 'setContract',
      sender: '',
      payload: code
    }, keys.secretKey);
    if (!read || read.code != code) {
      transactionBuffer.push({ transaction, account: keys.publicKey, publicKey: keys.publicKey });
    }
  }

  setInterval(async () => {
    if (running) return;
    running = true;
    if (transactionBuffer.length) {
      try {
        console.log('creating block');
        const cid = await createBlock(ipfs, transactionBuffer);
      } catch (e) {
        console.error("error creating block", e);
      }
    }
    running = false;
  }, 50);

  await ipfs.pubsub.subscribe(topic, async (msg) => {
    try {
      const message = packr.unpack(msg.data);
      console.log(message, message.newcid)
      if (message.newcid) {
        await ipfs.pin.add('/ipfs/' + message.newcid);
        console.log('pinned');
        if (!keys.secretKey) {
          await ipfs.files.rm('/data',{recursive:true})
          await ipfs.files.cp('/ipfs/' + message.newcid, '/data')
          console.log('added to data');
          const newcid = (await ipfs.files.stat("/data")).cid;
          console.log('data is', newcid.toString());
        }
      }
    } catch (e) {
      console.error(e);
    }
  })
  setInterval(async () => {
    const peerIds = await ipfs.pubsub.peers(topic)
    console.log(peerIds)
  }, 10000)

  console.log(`subscribed to ${topic}`)
  const getParent = async (p) => {
    try {
      const data = await crypto.read(ipfs, p);
      console.log(data);
      if (data.height == 3) return null;
      return data.parentcid;
    } catch (e) {
      console.log(e.message);
    }
  }
  let data = '/data/block';
  setTimeout(async () => {
    try {
      while (data) {
        data = await getParent(data != '/data/block' ? '/ipfs/' + data + '/block' : '/data/block');
        if (data) await ipfs.pin.add('/ipfs/' + data);
      }
    } catch (e) {
      console.error(e);
    }
  }, 0)
  if (client) client.on("message", async msg => {
    if (msg.content.startsWith("#") || msg.content.startsWith("token ") || msg.content.startsWith("chakra ")) {
      const payload = msg.content.replace("token ", "").replace("#", "").toLowerCase().split(" ").filter(param => (param.trim().length));
      let name = payload.shift();
      for (action of actions) {
        if (action.names.includes(name)) {
          try {
            await action.call(msg, ipfs, action, payload, transactionBuffer);
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  });
};

IPFS.create({
  EXPERIMENTAL: {
    pubsub: true // required, enables pubsub
  }
}).then(run);
