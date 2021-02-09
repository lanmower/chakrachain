const Discord = require("discord.js");
const { isNumeric } = require("validator");
const { BigNumber } = require("bignumber.js");
const ROOT_TOKEN = 'C';
const keys = require('./keys.js')
const crypto = require('./crypto.js');

const transact = (codecid, msg, transactionBuffer, ipfs, action, payload, response) => {
    const transaction = crypto.sign({
        codecid,
        contract: "token",
        action: action.names[0],
        sender: msg.author.id,
        payload
    }, keys.secretKey);
    const account = null;
    transactionBuffer.push({
        transaction, account,
        callback: async (error, data, { simtime, finaltime }, block, newcid) => {
            if (error && error.message) {
                msg.reply("error: " + error.message);
            }
            else {
                let parentcid = newcid.toString();
                let data = block;
                console.log({parentcid, data, newcid})
                const reply = new Discord.MessageEmbed()
                    .setTitle(`BLOCK ${data?data.height:''} TRANSACTION VERIFIED`)
                    .setURL(`https://ipfs.io/ipfs/${newcid.toString()}`)
                    .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpg', 'https://discord.js.org')
                    .setDescription(response)
                    .setFooter(`Chakrachain (SIM:${simtime}/FINAL:${finaltime})`);
                msg.channel.send(reply);
            }
        }
    });

}

const create = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    if (!payload.length) {
        msg.reply('please specify symbol (less than 10 letters, case insensitive)');
        return;
    }
    payload[0] = payload[0].toUpperCase();
    transact(codecid, msg, transactionBuffer, ipfs, action, payload, "Created " + payload[0] + ", subtracted 10 C");
}

const invite = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    let channel = msg.channel;
    try {
        const invite = await channel.createInvite({ maxAge: 0, unique: true });
        if (!payload.length) {
            msg.reply('please specify symbol (less than 10 letters, case insensitive)');
            return;
        }
        payload[0] = payload[0].toUpperCase();
        payload.push(invite.code)
        transact(codecid, msg, transactionBuffer, ipfs, action, payload, "Edited " + payload[0]);
    } catch (e) {
        msg.reply("ERROR: " + e.getmessage);
    }
}

const issue = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    if (payload[0].startsWith("<@"))
        payload[0] = payload[0].replace("<@", "").replace('!', '').replace(">", "");
    if (payload.length < 2) {
        msg.reply('not enough params, token issue (@user) <amount> <symbol>');
        return;
    }
    if (payload.length < 3) {
        const [quantity, symbol] = payload;
        while (payload.length) payload.shift();
        payload.push(msg.author.id);
        payload.push(quantity);
        payload.push(symbol);
    }
    payload[2] = (payload[2]).toUpperCase();
    if (!isNumeric(payload[0])) throw Error('Bad account:', payload[0]);
    response = `Issued ${payload[1]} ${payload[2]} to <@!${payload[0]}>`;
    transact(codecid, msg, transactionBuffer, ipfs, action, payload, response);
}

const transfer = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    if (payload[0].startsWith("<@"))
        payload[0] = payload[0].replace("<@", "").replace('!', '').replace(">", "");
    if (payload.length < 3) {
        msg.reply('not enough params');
        return;
    }
    payload[2] = payload[2].toUpperCase();
    if (!isNumeric(payload[0])) throw Error('Bad account:', payload[0]);
    transact(codecid, msg, transactionBuffer, ipfs, action, payload, `Transferred ${payload[1]} ${payload[2]} to <@!${payload[0]}>`);

}

const balances = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    const path = `/data/contracts/token/accounts/` + msg.author.id;
    const exampleEmbed = new Discord.MessageEmbed()
        .setTitle('BALANCES')
        .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpg', 'https://discord.js.org')
        .setFooter('Chakrachain');
    try {
        for await (const file of ipfs.files.ls(path)) {
            const loaded = await crypto.read(ipfs, `/data/contracts/token/balances/${file.name}/${msg.author.id}`);
            const token = await crypto.read(ipfs, `/data/contracts/token/tokens/${file.name}`);
            if (loaded) exampleEmbed.addFields({ name: file.name, value: (token.invite ? `\n[Join Discord](https://discord.gg/${token.invite})\n` : '') + loaded.balance, inline: true });
        }
        msg.channel.send(exampleEmbed);
    } catch (e) {
        msg.channel.send("You dont have any balances yet.")
    }
}
const calculateBalance = (balance, quantity, precision, add) =>
    add
        ? BigNumber(balance)
            .plus(quantity)
            .toFixed(precision)
        : BigNumber(balance)
            .minus(quantity)
            .toFixed(precision);

const pools = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    const path = `/data/contracts/token/pools/`;
    const exampleEmbed = new Discord.MessageEmbed()
        .setTitle('POOL PRICES')
        .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpgjpeg', 'https://discord.js.org')
        .setFooter('Chakrachain');
    fields = [];
    for await (const file of ipfs.files.ls(path)) {
        if (file.type != "directory") continue;
        if (file.name == ROOT_TOKEN) continue;
        const token = await crypto.read(ipfs, `/data/contracts/token/tokens/${file.name}`);
        const pool1 = await crypto.read(ipfs, `/data/contracts/token/balances/${file.name}/${ROOT_TOKEN}-pool`);
        const pool2 = await crypto.read(ipfs, `/data/contracts/token/balances/${ROOT_TOKEN}/${file.name}-pool`);

        let poolbalance1 = parseFloat(pool1.balance);
        let poolbalance2 = parseFloat(pool2.balance);
        let ratio = poolbalance2 / poolbalance1;
        if (pool1 && pool2) {
            fields.push({ name: file.name, ratio, pool1, pool2, token })
        }
    }
    fields.sort((a, b) => { return b.pool2.balance - a.pool2.balance });
    for (let field of fields) exampleEmbed.addFields({ name: field.name, value: (field.token.invite ? `[Join Discord](https://discord.gg/${field.token.invite})\n` : '') + `${field.name}: ${field.pool1.balance}\n${ROOT_TOKEN}: ${BigNumber(field.pool2.balance).toFixed(4)}\nPrice: ${(field.ratio).toFixed(4)}`, inline: true });
    msg.channel.send(exampleEmbed);
}

const balance = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    if (payload.length < 1) {
        msg.reply('Please specify token.');
    }
    payload[0] = payload[0].toUpperCase();
    const path = `/data/contracts/token/balances/${payload[0]}/${msg.author.id}`;
    const loaded = await crypto.read(ipfs, path);
    response = `Balance for <@!${msg.author.id}> ${loaded.balance} ${payload[0]}`;
    const exampleEmbed = new Discord.MessageEmbed()
        .setTitle('BALANCE')
        .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpg', 'https://discord.js.org')
        .setDescription(response)
        .setFooter('Chakrachain');
    msg.channel.send(exampleEmbed);
}

const help = async (codecid, msg) => {
    msg.reply(`\`\`\`token create <symbol>
Creates a new token

token issue <@user> <amount> <symbol>
issues to user

token issue <amount> <symbol>
issues to self

token pool <token> <token amount> <${ROOT_TOKEN} amount>
pool token with ${ROOT_TOKEN}

token swap <amount> <from symbol> <to symbol>
swaps a token for ${ROOT_TOKEN} or from ${ROOT_TOKEN}

token bals
display balances

token pools
display pools

token send <@user> <amount> <symbol>
perform a token transfer\`\`\``);
}

const pool = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    if (payload.length < 1) {
        msg.reply('not enough params');
        return;
    }
    payload[0] = payload[0].toUpperCase();
    if (payload.length < 2) {
        msg.reply('not enough params');
        return;
    }
    payload[1] = payload[1].toUpperCase();
    response = `Pooled ${payload[0]} ${payload[1]} against ${payload[2]} ` + ROOT_TOKEN;
    transact(codecid, msg, transactionBuffer, ipfs, action, payload, response);
}

const link = async (cid, msg) => {
    msg.reply('https://discord.com/api/oauth2/authorize?client_id=726135294952341575&permissions=18497&scope=bot');
}

const swap = async (codecid, msg, ipfs, action, payload, transactionBuffer) => {
    if (payload.length < 1) {
        msg.reply('not enough params');
        return;
    }
    const quantity = parseFloat(payload[0]);
    payload[1] = payload[1].toUpperCase();
    if (payload.length < 2) {
        msg.reply('not enough params');
        return;
    }
    let ratio
    symbol1 = payload[1].toUpperCase();
    symbol2 = payload[2].toUpperCase();
    const calcRatio = async (symbol1, symbol2) => {
        const pool1 = await crypto.read(ipfs, `/data/contracts/token/balances/${symbol1}/${symbol2}-pool`);
        const pool2 = await crypto.read(ipfs, `/data/contracts/token/balances/${symbol2}/${symbol1}-pool`);

        let poolbalance1 = parseFloat(pool1.balance);
        let poolbalance2 = parseFloat(pool2.balance);
        return poolbalance2 / poolbalance1;
    }
    if (symbol1 == ROOT_TOKEN || symbol2 == ROOT_TOKEN) {
        ratio = await calcRatio(symbol1, symbol2);
    } else {
        const ratio1 = await calcRatio(symbol1, ROOT_TOKEN);
        const ratio2 = await calcRatio(ROOT_TOKEN, symbol2);
        ratio = ratio1 * ratio2;
    }
    response = `Swapped ${payload[0]} ${symbol1} for ${calculateBalance(0, quantity * ratio, 8, true)} ${symbol2}`;
    transact(codecid, msg, transactionBuffer, ipfs, action, payload, response);
}

exports.actions = [
    {
        names: ['create'],
        call: create
    },
    {
        names: ['issue'],
        call: issue
    },
    {
        names: ["transfer", 'send', "tip", "trans"],
        call: transfer
    },
    {
        names: ['bals', 'balances'],
        call: balances
    },
    {
        names: ['balance', 'bal'],
        call: balance
    },
    {
        names: ['pool'],
        call: pool
    },
    {
        names: ['link'],
        call: link
    },
    {
        names: ['pools'],
        call: pools
    },
    {
        names: ['swap'],
        call: swap
    },
    {
        names: ['invite'],
        call: invite
    },
    {
        names: ['help'],
        call: help
    }
];