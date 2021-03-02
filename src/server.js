require('dotenv').config()
if (process.env.DISCORD) require('./discord/discord.js');
const {transactionBuffer} = require('./util/queues.js');

const { createBlock } = require('./blockchain/chain.js');
const pubsub = exports.pubsub = require("./util/pubsub.js")('chakrachain');
require('./util/contracts.js').update(transactionBuffer);


/*app.post("/hook", (req, res) => {
  console.log(req.body);
  res.status(200).end();
})*/

process.on('uncaughtException', function(err) {
  console.error(err);
});


const ready = async () => {
  pubsub.on('transaction',(t)=>{
    console.log(t);
    transactionBuffer.push(t);
  });
  pubsub.on('block',(t)=>{
    console.log('pubsub', t);
  });
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    if (transactionBuffer.length) {
      try {
        const block = await createBlock(transactionBuffer);
        pubsub.emit('block', block);
      } catch (e) {
        console.error("error creating block", e);
      }
    }
    running = false;
  }, 250);

  console.log('Waiting for messages')

};
ready (null);
