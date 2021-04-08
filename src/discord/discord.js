let client;
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
                    //msg.channel.startTyping();
                    action.call(msg, action, payload).catch(console.error);
                    console.log('ran');
                } catch(e) {
                    console.log('error');
                    console.error(e);
                    msg.reply('ERROR:'+e);
                }
            }
        }
    }
});