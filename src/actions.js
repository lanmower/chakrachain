const Discord = require("discord.js");
const { isNumeric } = require("validator");
const { BigNumber } = require("bignumber.js");
const ROOT_TOKEN = 'C';
const keys = require('./keys.js')
const crypto = require('./crypto.js');
const hyperdrivestorage = require('./hyperdrivestorage.js');

const transact = (msg, transactionBuffer, action, payload, response, cb) => {
    const transaction = crypto.sign({
        contract: keys.publicKey,
        action: action.names[0],
        sender: msg.author.id,
        payload
    }, keys.secretKey);
    const account = null;
    return new Promise(resolve => {
        transactionBuffer.push({
            transaction, publicKey: keys.publicKey,
            callback: async (error, data, { simtime, finaltime }, block) => {
                resolve(data);
                if (error && error.message) {
                    msg.channel.send(error.message);
                } else {
                    const reply = new Discord.MessageEmbed()
                        .setTitle(`BLOCK ${block ? block.h : ''} TRANSACTION VERIFIED`)
                        .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpg', 'https://discord.js.org')
                        .setDescription(response)
                        .setFooter(`Chakrachain (SIM:${simtime}/FINAL:${finaltime})`);
                    const rep = await msg.channel.send(reply);
                    setTimeout(()=>{rep.delete().catch(()=>{})}, 10000)
                    if(cb) cb(rep)
                }
            }
        });

    })

}

const create = async (msg, action, payload, transactionBuffer) => {
    if (!payload.length) {
        msg.channel.send('please specify symbol (less than 10 letters, case insensitive)');
        return;
    }
    transact(msg, transactionBuffer, action, payload, "Created " + payload[0] + ", subtracted 10 C");
}

const invite = async (msg, action, payload, transactionBuffer) => {
    let channel = msg.channel;
    try {
        const invite = await channel.createInvite({ maxAge: 0, unique: true });
        if (!payload.length) {
            msg.channel.send('please specify symbol (less than 10 letters, case insensitive)');
            return;
        }
        payload.push(invite.code)
        transact(msg, transactionBuffer, action, payload, "Edited " + payload[0]);
    } catch (e) {
        msg.channel.send("ERROR: " + e.getmessage);
    }
}

const issue = async (msg, action, payload, transactionBuffer) => {
    if (payload[0].startsWith("<@"))
        payload[0] = payload[0].replace("<@", "").replace('!', '').replace(">", "");
    if (payload.length < 2) {
        msg.channel.send('not enough params, token issue (@user) <amount> <symbol>');
        return;
    }
    if (payload.length < 3) {
        const [quantity, symbol] = payload;
        while (payload.length) payload.shift();
        payload.push(msg.author.id);
        payload.push(quantity);
        payload.push(symbol);
    }
    if (!isNumeric(payload[0])) throw Error('Bad account:', payload[0]);
    response = `Issued ${payload[1]} ${payload[2]} to <@!${payload[0]}>`;

    transact(msg, transactionBuffer, action, payload, response);
}
const migrate = async (msg, action, payload, transactionBuffer) => {
    response = `Done`;
    transact(msg, transactionBuffer, action, payload, response);
}

const faucet = async (msg, action, payload, transactionBuffer) => {
    if (payload.length < 2) {
        msg.channel.send('not enough params, faucet <amount> <symbol>');
        return;
    }
    payload[1] = payload[1].toUpperCase();
    const filter = reaction => reaction.emoji.name === '🍆';
    const rep = await msg.channel.send(payload[0]+' '+payload[1] + ' available, click on the emoji!')
    await rep.react('🍆');
    const collected = await rep.awaitReactions(filter, { time: 10000, max: 10 });
    const ret = await new Promise(async resolve => {
        await collected.map(async s => {
            if (!s || !s.users) return;
            try {
                const users = (await s.users.fetch()).keyArray();
                if (users.includes(msg.author.id)) delete users[msg.author.id];
                for (user of users) {
                    if (user != '726135294952341575' && user != msg.author.id) {
                        //codecid, msg, transactionBuffer, action, payload, response
                        const userCount = users.length - 1;
                        const input = parseFloat(payload[0]);
                        const quantity = new BigNumber(input / userCount).toFixed(8)
                        await transact({ reply: msg.channel.send, channel: msg.channel, author: { id: msg.author.id } }, transactionBuffer, { names: ['transfer'] }, [user, quantity, payload[1]], 'Sent ' + quantity + ` ${payload[1]} to <@!${user}>`, (resp)=>{
                        });
                    }
                }
                if (users.length > 1) resolve(true);
                else resolve(false);
            } catch (e) {
                resolve(false);
                console.error(e);
            }
        })
        rep.delete().catch(()=>{});
    })
    return ret;
}

const transfer = async (msg, action, payload, transactionBuffer) => {
    if (payload[0].startsWith("<@"))
        payload[0] = payload[0].replace("<@", "").replace('!', '').replace(">", "");
    if (payload.length < 3) {
        msg.channel.send('not enough params');
        return;
    }
    //if (!isNumeric(payload[0])) throw Error('Bad account:', payload[0]);
    transact(msg, transactionBuffer, action, payload, `Transferred ${payload[1]} ${payload[2]} to <@!${payload[0]}>`);

}

const balances = async (msg, action, payload, transactionBuffer) => {
    const path = `contracts-${keys.publicKey}-accounts-` + msg.author.id;
    const exampleEmbed = new Discord.MessageEmbed()
        .setTitle('BALANCES')
        .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpg', 'https://discord.js.org')
        .setFooter('Chakrachain');
    try {
        const files = await hyperdrivestorage.ls(path);
        
        for (const fi of files) {
            console.log(fi)
            const loaded = await hyperdrivestorage.read(`contracts-${keys.publicKey}-balances-${fi}-${msg.author.id}`);
            const token = await hyperdrivestorage.read(`contracts-${keys.publicKey}-tokens-${fi}`);
            if (loaded) exampleEmbed.addFields({ name: fi, value: (token.invite ? `\n[Join Discord](https://discord.gg/${token.invite})\n` : '') + loaded.balance, inline: true });
        }
        const sent = await msg.channel.send(exampleEmbed);
        setTimeout(()=>{sent.delete().catch(()=>{})}, 30000)
    } catch (e) {
        console.error(e);
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

const pools = async (msg, action, payload, transactionBuffer) => {
    const path = `contracts-${keys.publicKey}-pool`;
    const exampleEmbed = new Discord.MessageEmbed()
        .setTitle('POOL PRICES')
        .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpgjpeg', 'https://discord.js.org')
        .setFooter('Chakrachain');
    fields = [];
    const files = await hyperdrivestorage.ls(path)
    for (const fi of files) {
        const token = await hyperdrivestorage.read(`contracts-${keys.publicKey}-tokens-${fi}`);
        const pool = await hyperdrivestorage.read(`contracts-${keys.publicKey}-pool-${fi}`);
        let poolbalance1 = parseFloat(pool[token.symbol]);
        let poolbalance2 = parseFloat(pool[ROOT_TOKEN]);
        let ratio = poolbalance2/poolbalance1;
        //if (poolbalance1>0 && poolbalance2>0) {
            fields.push({ name: fi, ratio, pool, token })
        //}
    }
    fields.sort((a, b) => { return b.pool.balance - a.pool[ROOT_TOKEN] });
    for (let field of fields) {
        exampleEmbed.addFields({ 
            name: field.name, 
            value: (field.token.invite ? `[Join Discord](https://discord.gg/${field.token.invite})\n` : '') +
            `${field.name}: ${field.pool[field.name]}\n${ROOT_TOKEN}: ${BigNumber(field.pool[ROOT_TOKEN]).toFixed(4)}\nPrice: ${(field.ratio).toFixed(4)}`,
             inline: true });
    }
    const sent = await msg.channel.send(exampleEmbed);
    setTimeout(()=>{if(sent.delete) sent.delete().catch(()=>{})}, 30000)
}

const balance = async (msg, action, payload, transactionBuffer) => {
    if (payload.length < 1) {
        msg.channel.send('Please specify token.');
    }
    payload[0] = payload[0].toUpperCase();
    const path = `contracts-${keys.publicKey}-balances-${payload[0]}-${msg.author.id}`;
    const loaded = await hyperdrivestorage.read(path);
    response = `Balance for <@!${msg.author.id}> ${loaded.balance} ${payload[0]}`;
    const exampleEmbed = new Discord.MessageEmbed()
        .setTitle('BALANCE')
        .setAuthor('Chakrachain', 'https://i.imgflip.com/r1u53.jpg', 'https://discord.js.org')
        .setDescription(response)
        .setFooter('Chakrachain');
    const sent = msg.channel.send(exampleEmbed);
    setTimeout(()=>{if(sent.delete) sent.delete().catch(()=>{})}, 30000)
}

const help = async (msg) => {
    msg.channel.send(`\`\`\`You can use this bot to advertise your discord server
and incentivise your discord community, ChuckRobot is an
alpha project that runs an P2P cryptographic
ledger to store your transactional history

Available commands:
    
token create <symbol>
Creates a new token

#issue <@user> <amount> <name>
issues to user

#issue <amount> <name>
issues to self

#pool <token amount> <token> <${ROOT_TOKEN} amount>
pool token with ${ROOT_TOKEN}

#swap <amount> <from name> <to name>
swaps a token for ${ROOT_TOKEN} or from ${ROOT_TOKEN}

#bals
display balances

#pools
display pools

#pools
display pools

#send <@user> <amount> <name>
perform a token transfer

#faucet <amount> <name>
hand the token out to emoji clickers, after 10 seconds

#autofaucet <amount> <name> <count>
run autofaucet until x amount of handouts are reached

#invite <name>
link your token to the current discord channel with an invite

#link
invite this bot to your discord
\`\`\``);
}

const pool = async (msg, action, payload, transactionBuffer) => {
    if (payload.length < 1) {
        msg.channel.send('not enough params');
        return;
    }
    payload[0] = payload[0].toUpperCase();
    if (payload.length < 2) {
        msg.channel.send('not enough params');
        return;
    }
    payload[1] = payload[1].toUpperCase();
    response = `Pooled ${payload[0]} ${payload[1]} against ${payload[2]} ` + ROOT_TOKEN;
    transact(msg, transactionBuffer, action, payload, response);
}

const link = async (msg) => {
    msg.channel.send('https://discord.com/api/oauth2/authorize?client_id=726135294952341575&permissions=18497&scope=bot');
}

const swap = async (msg, action, payload, transactionBuffer) => {
    if (payload.length < 1) {
        msg.channel.send('not enough params');
        return;
    }
    const quantity = parseFloat(payload[0]);
    payload[1] = payload[1].toUpperCase();
    if (payload.length < 2) {
        msg.channel.send('not enough params');
        return;
    }
    let ratio
    symbol1 = payload[1].toUpperCase();
    symbol2 = payload[2].toUpperCase();
    const notroot = symbol1!=ROOT_TOKEN?symbol1:symbol2;
    const calcRatio = async (symbol1, symbol2) => {
        const pool = await hyperdrivestorage.read(`contracts-${keys.publicKey}-pool-${symbol1}`);
        let poolbalance1 = parseFloat(pool[symbol1]);
        let poolbalance2 = parseFloat(pool[symbol2]);
        return poolbalance2 / poolbalance1;
    }
    if (symbol1 == ROOT_TOKEN || symbol2 == ROOT_TOKEN) {
        ratio = await calcRatio(notroot, ROOT_TOKEN);
        if(notroot == symbol2) ratio = 1 / ratio;
    } else {
        const ratio1 = await calcRatio(symbol1, ROOT_TOKEN);
        const ratio2 = await calcRatio(symbol2, ROOT_TOKEN);
        ratio = ratio2/ratio1;
    }
    response = `Swapped ${payload[0]} ${symbol1} for ${calculateBalance(0, quantity * ratio, 8, true)} ${symbol2}`;
    transact(msg, transactionBuffer, action, payload, response);
}
let faucets=0;
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
        names: ['migrate'],
        call: migrate
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
        names: ['faucet'],
        call: faucet
    },
    {
        names: ['autofaucet'],
        call: (msg, action, payload, transactionBuffer) => {
            let times = parseInt(payload[2]);
            if(times > 10) times = 10;
            ++faucets;
            const run = async () => { 
                try {
                if (times < 1) {
                    --faucets;
                    clearInterval(int);
                }
                
                const path = `contracts-${keys.publicKey}-balances-${payload[1].toUpperCase()}-${msg.author.id}`;
                const loaded = await hyperdrivestorage.read(path);
                if(loaded.balance < parseFloat(payload[1])) {
                    --faucets;
                    clearInterval(int);
                }
                if (await faucet(msg, action, payload, transactionBuffer)) times--;
                } catch(e) {
                    console.log(e);
                    --faucets;
                    clearInterval(int);
                }
            }
            const int = setInterval(run, 11000);
            run();
        }
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