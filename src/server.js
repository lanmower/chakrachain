require('dotenv').config()
const express = require("express");
const fs = require("fs");
const app = express();
const Discord = require("discord.js");
const { Packr } = require('msgpackr');
let client;
if (process.env.DISCORD) client = new Discord.Client();
//console.log(process.env.DISCORD)
const { actions } = require("./actions.js");
const { createBlock } = require('./chain.js');
const crypto = require('./crypto.js');
const hyperdrivestorage = require('./hyperdrivestorage.js');
const keys = require('./keys.js');
require('events').setMaxListeners(4096);
require('events').EventEmitter.prototype._maxListeners = 4096;
if (client) client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});
app.post("/hook", (req, res) => {
  console.log(req.body);
  res.status(200).end();
})

if (client) client.login(process.env.DISCORD);

const run = async ipfs => {
  global.ipfs = ipfs;

  ready(ipfs);

  //await ipfs.add(fs.readFileSync("./explorer.html"))
  //const explorer = (await ipfs.add(fs.readFileSync("./explorer.html"))).cid;
  //try {await ipfs.files.rm('/data/explorer.html');} catch (e) {}
  //await ipfs.files.cp('/data/' + explorer.toString(), '/data/explorer.html', { parents: true });
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

  if (keys.secretKey) {
    const code = fs.readFileSync('src/tokens.js').toString();
    const read = (await hyperdrivestorage.read(`contracts-${keys.publicKey}-current`)).code;
    console.log('CODE:',code==read); //contracts-0ebd8087442a81030913fe9a9177834a4f1091809e890e50de2ff0cc525e1a56-current
    const transaction = crypto.sign({
      contract: keys.publicKey,
      action: 'setContract',
      sender: '',
      payload: code
    }, keys.secretKey);
    if (!read || read != code) {
      transactionBuffer.push({ transaction, account: keys.publicKey, publicKey: keys.publicKey });
    }
  }

  setInterval(async () => {
    if (running) return;
    running = true;
    if (transactionBuffer.length) {
      try {
        console.log('creating block');
        console.log(await createBlock(ipfs, transactionBuffer));
      } catch (e) {
        console.error("error creating block", e);
      }
    }
    running = false;
  }, 250);

  console.log('Waiting for messages')
  if (client) client.on("message", async msg => {
    if (msg.content.startsWith("#") || msg.content.startsWith("token ") || msg.content.startsWith("chakra ")) {
      const payload = msg.content.replace("token ", "").replace("#", "").toLowerCase().split(" ").filter(param => (param.trim().length));
      let name = payload.shift();
      for (action of actions) {
        if (action.names.includes(name)) {
          try {
            //console.log(action);
            await action.call(msg, action, payload, transactionBuffer);
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  });
};


run (null);
