let client;
const {transactionBuffer} = require('../blockchain/chain.js');
const { actions } = require("./actions.js");
const Discord = require("discord.js");

client = new Discord.Client();
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
client.login(process.env.DISCORD);
client.on("message", async msg => {
    if (msg.content.startsWith("#") || msg.content.startsWith("token ") || msg.content.startsWith("chakra ")) {
        const payload = msg.content.replace("token ", "").replace("#", "").toLowerCase().split(" ").filter(param => (param.trim().length));
        let name = payload.shift();
        for (action of actions) {
            if (action.names.includes(name)) {
                try {
                    msg.channel.startTyping();
                    await action.call(msg, action, payload, transactionBuffer);
                } catch (e) {
                    console.error(e);
                } finally {
                    msg.channel.stopTyping();
                }
            }
        }
    }
});