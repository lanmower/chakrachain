require('dotenv').config()
const express = require("express");
const fs = require("fs");
const app = express();
const all = require("it-all");
const IPFS = require("ipfs-core");
const Discord = require("discord.js");
const client = new Discord.Client();
const { actions } = require("./actions.js");
const {createBlock} = require('./chain.js');

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});
app.post("/hook", (req, res) => {
  console.log(req.body);
  res.status(200).end();
})

client.login(process.env.DISCORD);

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

  setInterval(async () => {
    if (running) return;
    running = true;
    if (transactionBuffer.length) {
      try {
        const cid = await createBlock(ipfs, transactionBuffer);
      } catch (e) {
        console.error("error creating block", e);
      }
    }
    running = false;
  }, 50);
  const codecid = (await ipfs.add(fs.readFileSync("./tokens.js"))).cid.toString();
  client.on("message", async msg => {
    if (msg.content.startsWith("#") || msg.content.startsWith("token ") || msg.content.startsWith("chakra ")) {
      const payload = msg.content.replace("token ", "").replace("#", "").toLowerCase().split(" ").filter(param => (param.trim().length));
      let name = payload.shift();
      for (action of actions) {
        if (action.names.includes(name)) {
          try {
            await action.call(codecid, msg, ipfs, action, payload, transactionBuffer);
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  });
};

IPFS.create().then(run);
