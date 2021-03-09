require('dotenv').config()
if (process.env.DISCORD) require('./discord/discord.js');

process.on('uncaughtException', function(err) {
  console.error(err);
});

