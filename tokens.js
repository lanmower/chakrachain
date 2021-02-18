/* global actions, api, assert, decimals, addBalance */
() => {
  const ROOT_TOKEN = "C";
  const decimals = value => api.BigNumber(value).dp();
  const swap = payload => {
    const [quantity, s, s2] = payload;
    const symbol = s.toUpperCase();
    const symbol2 = s2.toUpperCase()
    api.assert([
      [symbol && typeof symbol === "string", "bad symbol"],
      [symbol2 && typeof symbol === "string", "bad symbol"],
      [quantity, "no quantity"],
      [typeof quantity === "string", "quantity must be a string"],
      [!api.BigNumber(quantity).isNaN(), "quantity must be a number"]
    ]);
    const token = api.read("tokens/" + symbol);
    const token2 = api.read("tokens/" + symbol2);

    const nonroot = symbol!=ROOT_TOKEN?symbol:symbol2;
    const pool = api.read("pool/" + nonroot);
    console.log("pool/" + nonroot, pool);

    let poolbalance1 = parseFloat(pool[symbol])||0;
    let poolbalance2 = parseFloat(pool[symbol2])||0;
    api.assert(pool, 'please pool some tokens first: ```token pool <amount> <tokenname> <' + ROOT_TOKEN + ' amount>``` and then you can swap.');
    let ratio = poolbalance2/poolbalance1;
    console.log({ratio})
    api.assert(pool[symbol2] > (quantity * ratio), `Not enough ${symbol} ${(symbol2!=ROOT_TOKEN?`in the ${symbol2} pool `:'')}: ${pool.balance} ${symbol} available`);

    subBalance(api.sender, token, quantity);

    const poolamnt = quantity * 0.95;
    const feeamnt = quantity * 0.05;

    pool[symbol] = calculateBalance(pool[symbol]||0, poolamnt, 8, true);
    pool['rewards'] = calculateBalance(pool['rewards']||0, feeamnt, 8, true);
    pool[symbol2] = calculateBalance(pool[symbol2]||0, quantity*ratio, 8, false);
    api.assert(pool[symbol2] > 0, 'pool overdrawn, needs more '+symbol2);

    api.write('pool/'+nonroot, pool)

    addBalance(api.sender, token2, quantity * ratio);

    if (!token) throw new Error("does not exist");
    api.assert([
      [decimals(quantity) <= token.precision, "name precision mismatch"],
      [api.BigNumber(quantity).gt(0), "must transfer positive quantity"]
    ]);
    addAccount(api.sender, token2);
    return api.BigNumber(quantity * ratio).toFixed(token2.precision);
  }

  const addBalance = (account, token, quantity, table = "balances", type = 'balance') => {
    quantity = api.BigNumber(quantity).toFixed(8);
    let balance = api.read(table + "/" + token.symbol + "/" + account);
    if (balance == null) {
      balance = balanceTemplate;
      balance.account = account;
      balance.symbol = token.symbol;
      balance.balance = calculateBalance('0', quantity, 8, true);
      api.write(table + "/" + token.symbol + "/" + account, balance);

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
      "cannot add "+quantity+" to "+originalBalance
    );

    api.write(table + "/" + token.symbol + "/" + account, balance, type = 'balance');
    return true;
  };

  const migrate = () => {
    api.clear('pool')
    api.clear('pools-C')
    api.clear('pools-DROP')
    api.clear('pools-EGGPLANT')
    api.clear('pools-FREN')
    api.clear('pools-KARMA')
    api.clear('pools-ROOT')
    api.clear('pools-SOLPLEX')
    api.clear('pools-SWAG')
  }

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

  const subBalance = (account, token, quantity, table = "balances", type = 'balance', sim = false) => {
    quantity = api.BigNumber(quantity).toFixed(8);
    let balance = api.read(table + "/" + token.symbol + "/" + account);
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
    api.write(table + "/" + token.symbol + "/" + account, balance);

    return true;
  };

  const addAccount = (account, token) => {
    api.write("accounts/" + account + "/" + token.symbol, '');
  };

  const balanceTemplate = {
    account: null,
    symbol: null,
    balance: "0"
  };
  if((api.publicKey != api.contract) || !api.validator.isInt(api.sender)) api.sender = api.publicKey; //if its not the creator of the contract, or its not from discord (numeric accs, for oracle side storage), only allow to act on behalf of 
  return {
    invite: payload => {
      payload[0] = payload[0].toUpperCase();
      const [symbol, invite] = payload;
      api.assert([
        [typeof invite === "string", "invite must be a string"],
      ]);
      const token = api.read("tokens/" + symbol);
      if (!token) throw new Error("token doesn't exist, did you spell it right?");
      api.assert(token.issuer === api.sender, "only the owner of the token can add invites");
      token.invite = invite;
      api.write("tokens/" + symbol, token);
    },
    create: payload => {
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
      const r = api.read("tokens/" + ROOT_TOKEN);

      if(r) api.assert(subBalance(api.sender, r, "10"), 'You need 10 C to create a token, pool your token and someone will dump in some C.' + ROOT_TOKEN);

      const token = api.read("tokens/" + symbol);
      if (token) throw new Error(symbol+" already exists");

      const newToken = {
        issuer: api.sender,
        symbol,
        precision,
        maxSupply: api.BigNumber(maxSupply).toFixed(precision),
        supply: "0",
        circulatingSupply: "0"
      };
      api.write("tokens/" + symbol, newToken);
    },
    //migrate,
    issue: payload => {
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

      const token = api.read("tokens/" + symbol);
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
      let res = addBalance(finalTo, token, quantity);
      api.assert(res, "not added to balance");
      token.supply = calculateBalance(
        token.supply,
        quantity,
        token.precision,
        true
      );
      api.write("tokens/" + symbol, token);
      addAccount(finalTo, token);
    },
    swap: payload => {
      const [quantity, s, s2] = payload;
      const symbol = s.toUpperCase();
      const symbol2 = s2.toUpperCase()
      if (symbol != ROOT_TOKEN && symbol2 != ROOT_TOKEN) {
        const rootquantity = swap([quantity, symbol, ROOT_TOKEN]);
        swap([rootquantity, ROOT_TOKEN, symbol2]);
      } else swap(payload);
    },
    pool: payload => {
      let [quantity, symbol, rootquantity] = payload;
      if(symbol == ROOT_TOKEN) throw new Error('can not pool '+ROOT_TOKEN+' try pool a created token')
      api.assert([
        [symbol && typeof symbol === "string", "bad name"],
        [typeof quantity === "string", "quantity must be a string"],
        [typeof rootquantity === "string", ROOT_TOKEN + " quantity must be a string"],
        [!api.BigNumber(quantity).isNaN(), "quantity must be a number"],
        [!api.BigNumber(rootquantity).isNaN(), "the " + ROOT_TOKEN + " quantity must be a number"]
      ]);

      quantity = parseFloat(quantity);
      rootquantity = parseFloat(rootquantity);

      const token = api.read("tokens/" + symbol);
      let pool = api.read("pool/" + symbol);
      if(!pool) {
        pool = {};
        pool[ROOT_TOKEN]=0
        pool[symbol]=0;
        pool['rewards']=0
      }
      const r = api.read("tokens/" + ROOT_TOKEN);
      if (!token) throw new Error("does not exist")

      api.assert([
        [decimals(quantity) <= token.precision, "precision mismatch on "+token.symbol],
        [decimals(rootquantity) <= r.precision, "precision mismatch on "+r.symbol],
      ]);
      if (quantity) {
        subBalance(api.sender, token, quantity);
      }
      if (rootquantity) {
        subBalance(api.sender, r, rootquantity)
        addBalance(api.sender, token, rootquantity, 'pools');
      }
      if(isNaN(pool[ROOT_TOKEN])) pool[ROOT_TOKEN]='0';
      if(isNaN(pool[symbol])) pool[symbol]='0';
      pool[ROOT_TOKEN] = calculateBalance(
        pool[ROOT_TOKEN]||'0',
        rootquantity,
        r.precision,
        true
      );
      pool[symbol] = calculateBalance(
        pool[symbol]||'0',
        quantity,
        token.precision,
        true
      );
      console.log(pool, quantity, rootquantity)
      console.log("pool/"+symbol, pool);
      api.write("pool/" + symbol, pool);
    },
    transfer: payload => {
      payload[2] = payload[2].toUpperCase();
      const [to, quantity, symbol] = payload;
      api.assert([
        [symbol && typeof symbol === "string", "bad name: "+symbol],
        [quantity, "no quantity"],
        [typeof quantity === "string", "quantity must be a string"],
        [!api.BigNumber(quantity).isNaN(), "quantity must be a number"]
      ]);
      const finalTo = to.trim();
      const token = api.read("tokens/" + symbol);
      if (!token || !token.precision) throw new Error("does not exist");
      api.assert([
        [finalTo !== api.sender, "cannot transfer to self"],
        [decimals(quantity) <= token.precision, "precision mismatch"],
        [api.BigNumber(quantity).gt(0), "must transfer positive quantity"]
      ]);
      const res = subBalance(api.sender, token, quantity);
      if (res) addBalance(finalTo, token, quantity);
      addAccount(finalTo, token);
    }
  };
};
