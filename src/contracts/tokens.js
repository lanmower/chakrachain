/* global actions, api, assert, decimals, addBalance */
//v0.9
() => {
  const ROOT_TOKEN = "C";
  const decimals = value => api.BigNumber(value).dp();
  const swap = async payload => {
    const [quantity, s, s2] = payload;
    const symbol = s.toUpperCase();
    const symbol2 = s2.toUpperCase()
    api.assert([
      [symbol && typeof symbol === "string", "bad symbol"],
      [symbol2 && typeof symbol === "string", "bad symbol"],
      [quantity, "no quantity"],
      [typeof quantity === "string", "quantity must be a string: <quantity> <fron type> <to type>"],
      [!api.BigNumber(quantity).isNaN(), "quantity must be a number: <quantity> <from type> <to type>"]
    ]);
    const token = await api.read("tokens/" + symbol);
    const token2 = await api.read("tokens/" + symbol2);

    const nonroot = symbol != ROOT_TOKEN ? symbol : symbol2;
    const pool = await api.read("pool/" + nonroot);

    let poolbalance1 = parseFloat(pool[symbol]) || 0;
    let poolbalance2 = parseFloat(pool[symbol2]) || 0;
    api.assert(pool, 'please pool some tokens first: ```token pool <amount> <tokenname> <' + ROOT_TOKEN + ' amount>``` and then you can swap.');
    let ratio = poolbalance2 / poolbalance1;
    api.assert(pool[symbol2] > (quantity * ratio), `Not enough ${symbol} ${(symbol2 != ROOT_TOKEN ? `in the ${symbol2} pool ` : '')}: ${pool.balance} ${symbol} available`);

    console.log('subbing', { token, quantity })
    console.log('adding', { token2, quantity: quantity * ratio })

    const poolamnt = quantity * 0.95;
    const feeamnt = quantity * 0.05;
    await subBalance(api.sender, token, quantity);

    pool[symbol] = calculateBalance(pool[symbol] || 0, poolamnt, 8, true);
    pool['rewards'] = calculateBalance(pool['rewards'] || 0, feeamnt, 8, true);
    pool[symbol2] = calculateBalance(pool[symbol2] || 0, quantity * ratio, 8, false);
    api.assert(pool[symbol2] > 0, 'pool overdrawn, needs more ' + symbol2);

    await api.write('pool/' + nonroot, pool)

    await addBalance(api.sender, token2, quantity * ratio);

    if (!token) throw new Error("does not exist");
    api.assert([
      [decimals(quantity) <= token.precision, "name precision mismatch"],
      [api.BigNumber(quantity).gt(0), "must transfer positive quantity"]
    ]);
    await addAccount(api.sender, token2);
    return quantity;
  }

  const addBalance = async (account, token, quantity, table = "balances", type = 'balance') => {
    quantity = api.BigNumber(quantity).toFixed(8);
    let balance = await api.read(table + "/" + token.symbol + "/" + account);
    if (balance == null) {
      balance = balanceTemplate;
      balance.account = account;
      balance.symbol = token.symbol;
      balance.balance = calculateBalance('0', quantity, 8, true);
      await api.write(table + "/" + token.symbol + "/" + account, balance);

      return true;
    }

    const originalBalance = api.BigNumber(balance.balance);
    balance.balance = calculateBalance(
      balance.balance,
      quantity,
      token.precision,
      true
    ).toString();
    api.assert(
      api.BigNumber(balance.balance).gt(originalBalance),
      "cannot add " + quantity + " to " + originalBalance
    );

    await api.write(table + "/" + token.symbol + "/" + account, balance, type = 'balance');
    return true;
  };

  const calculateBalance = (balance, quantity, precision, add) =>
    add
      ? api
        .BigNumber(balance)
        .plus(quantity)
        .toFixed(precision)
      : api
        .BigNumber(balance)
        .minus(quantity)
        .toFixed(precision);

  const subBalance = async (account, token, quantity, table = "balances", type = 'balance', sim = false) => {
    quantity = api.BigNumber(quantity).toFixed(8);
    let balance = await api.read(table + "/" + token.symbol + "/" + account);
    if (!balance) throw new Error('You first need some ' + token.symbol)
    api.assert([
      [balance !== null, "balance does not exist"],
      [api.BigNumber(balance.balance).gte(quantity), `overdrawn balance: ${quantity} ${token.symbol} more than available ${balance.balance}`]
    ]);
    const originalBalance = api.BigNumber(balance.balance);

    balance.balance = calculateBalance(
      balance.balance,
      quantity,
      token.precision,
      false
    );
    api.assert(
      api.BigNumber(balance.balance).lt(originalBalance),
      `cannot subtract ${quantity} ${token.symbol} from ${account} (BAL:${originalBalance})`
    );
    await api.write(table + "/" + token.symbol + "/" + account, balance);

    return true;
  };

  const addAccount = async (account, token) => {
    await api.write("accounts/" + account + "/" + token.symbol, { enabled: true });
  };
  const balanceTemplate = {
    account: null,
    symbol: null,
    balance: "0"
  }; 
  if ((api.publicKey != api.contract) || (!api.sender || !api.validator.isInt(api.sender))) api.sender = api.publicKey; //if its not the creator of the contract, or its not from discord (numeric accs, for oracle side storage), only allow to act on behalf of 
  return {
    invite: async payload => {
      payload[0] = payload[0].toUpperCase();
      const [symbol, invite] = payload;
      const token = await api.read("tokens/" + symbol);
      if (!token) throw new Error("token doesn't exist, did you spell it right?");
      api.assert(token.issuer === api.sender, "only the owner of the token can add invites");
      token.invite = invite;
      await api.write("tokens/" + symbol, token);
    },
    create: async payload => {
      const symbol = payload[0].toUpperCase();
      const precision = 8,
        maxSupply = Number.MAX_SAFE_INTEGER.toString();

      api.assert([
        [symbol && typeof symbol === "string", "invalid name:" + symbol],
        [
          (precision && typeof precision === "number") || precision === 0,
          "invalid precision"
        ],
        [maxSupply, "no max supply"],
        [typeof maxSupply === "string", "max supply must be a string"],
        [api.validator.isAlpha(symbol), "invalid symbol:" + symbol],
        [api.validator.isUppercase(symbol), "symbol must be upper case"],
        [
          symbol.length > 0 && symbol.length <= 10,
          "symbol must be less than 10 long"
        ],
        [
          precision >= 0 && precision <= 8 && Number.isInteger(precision),
          "invalid precision"
        ],
        [api.BigNumber(maxSupply).gt(0), "maxSupply must be positive"],
        [
          api.BigNumber(maxSupply).lte(Number.MAX_SAFE_INTEGER),
          `maxSupply must be lower than ${Number.MAX_SAFE_INTEGER}`
        ]
      ]);
      const r = await api.read("tokens/" + ROOT_TOKEN);

      if (r) api.assert(await subBalance(api.sender, r, "10"), 'You need 10 C to create a token, pool your token and someone will dump in some C.' + ROOT_TOKEN);

      const token = await api.read("tokens/" + symbol);
      if (token) throw new Error(symbol + " already exists");

      const newToken = {
        issuer: api.sender,
        symbol,
        precision,
        maxSupply: api.BigNumber(maxSupply).toFixed(precision),
        supply: "0",
        circulatingSupply: "0"
      };
      await api.write("tokens/" + symbol, newToken);
    },
    //migrate,
    issue: async payload => {
      payload[2] = (payload[2]).toUpperCase();
      const [to, quantity, symbol] = payload;
      const finalTo = to.trim();
      api.assert([
        [finalTo && to && typeof to === "string", "bad destination"],
        [
          quantity &&
          typeof quantity === "string" &&
          !api.BigNumber(quantity).isNaN(),
          "bad quantity"
        ]
      ]);

      let token = await api.read("tokens/" + symbol);
      if (!token) throw new Error("Does not exist yet, use create first.");
      api.assert([
        [token.issuer === api.sender, "only the owner of the token can issue it"],
        [decimals(quantity) <= token.precision, "decimal error"],
        [api.BigNumber(quantity).gt(0), "cant issue a negative quantity"],
        [
          api
            .BigNumber(token.maxSupply)
            .minus(token.supply)
            .gte(quantity),
          "quantity exceeds available supply"
        ]
      ]);
      let res = await addBalance(finalTo, token, quantity);
      api.assert(res, "not added to balance");
      token.supply = calculateBalance(
        token.supply,
        quantity,
        token.precision,
        true
      );
      await api.write("tokens/" + symbol, token);
      await addAccount(finalTo, token);
    },
    swap: async payload => {
      console.log("SWAP");
      const [quantity, s, s2] = payload;
      const symbol = s.toUpperCase();
      const symbol2 = s2.toUpperCase()
      if (symbol != ROOT_TOKEN && symbol2 != ROOT_TOKEN) {
        const rootquantity = await swap([quantity, symbol, ROOT_TOKEN]);

        await swap([rootquantity, ROOT_TOKEN, symbol2]);
      } else await swap(payload);
    },
    pool: async payload => {
      let [quantity, symbol, rootquantity] = payload;
      if (symbol == ROOT_TOKEN) throw new Error('can not pool ' + ROOT_TOKEN + ' try pool a created token')
      api.assert([
        [symbol && typeof symbol === "string", "bad name"],
        [typeof quantity === "string", "quantity must be a string"],
        [typeof rootquantity === "string", ROOT_TOKEN + " quantity must be a string"],
        [!api.BigNumber(quantity).isNaN(), "quantity must be a number"],
        [!api.BigNumber(rootquantity).isNaN(), "the " + ROOT_TOKEN + " quantity must be a number"]
      ]);

      quantity = parseFloat(quantity);
      rootquantity = parseFloat(rootquantity);

      const token = await api.read("tokens/" + symbol);
      let pool = await api.read("pool/" + symbol);
      if (!pool) {
        pool = {};
        pool[ROOT_TOKEN] = 0
        pool[symbol] = 0;
        pool['rewards'] = 0
      }
      const r = await api.read("tokens/" + ROOT_TOKEN);
      if (!token) throw new Error("does not exist")

      api.assert([
        [decimals(quantity) <= token.precision, "precision mismatch on " + token.symbol],
        [decimals(rootquantity) <= r.precision, "precision mismatch on " + r.symbol],
      ]);
      if (quantity) {
        await subBalance(api.sender, token, quantity);
      }
      if (rootquantity) {
        await subBalance(api.sender, r, rootquantity)
        await addBalance(api.sender, token, rootquantity, 'pools');
      }
      if (isNaN(pool[ROOT_TOKEN])) pool[ROOT_TOKEN] = '0';
      if (isNaN(pool[symbol])) pool[symbol] = '0';
      pool[ROOT_TOKEN] = calculateBalance(
        pool[ROOT_TOKEN] || '0',
        rootquantity,
        r.precision,
        true
      );
      pool[symbol] = calculateBalance(
        pool[symbol] || '0',
        quantity,
        token.precision,
        true
      );
      await api.write("pool/" + symbol, pool);
    },
    transfer: async payload => {
      payload[2] = payload[2].toUpperCase();
      const [to, quantity, symbol] = payload;
      const finalTo = to.trim();
      await api.assert([
        [symbol && typeof symbol === "string", "bad name: " + symbol],
        [quantity, "no quantity"],
        [typeof quantity === "string", "quantity must be a string: <to> <quantity> <symbol>"],
        [!api.BigNumber(quantity).isNaN(), "quantity must be a number: <to> <quantity> <symbol>"],
        [finalTo.length, 'the to address must be filled in: <to> <quantity> <symbol>']
      ]);
      const token = await api.read("tokens/" + symbol);
      if (!token || !token.precision) throw new Error("does not exist");
      api.assert([
        [finalTo !== api.sender, "cannot transfer to self"],
        [decimals(quantity) <= token.precision, "precision mismatch"],
        [api.BigNumber(quantity).gt(0), "must transfer positive quantity"]
      ]);
      const res = await subBalance(api.sender, token, quantity);
      if (res) await addBalance(finalTo, token, quantity);
      await addAccount(finalTo, token);
    }
  }
}
