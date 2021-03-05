require('dotenv').config()
if (process.env.DISCORD) require('./discord/discord.js');

/*app.post("/hook", (req, res) => {
  console.log(req.body);
  res.status(200).end();
})*/

process.on('uncaughtException', function(err) {
  console.error(err);
});


const ready = async () => {
  /*
  pubsub.on('block',(t)=>{
    console.log('pubsub', t);
  });*/
  console.log('Waiting for messages')

};
ready (null);
