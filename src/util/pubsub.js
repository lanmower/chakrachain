const SDK = require('hyper-sdk');
const { Packr } = require('msgpackr');
let packr = new Packr();

exports.server = (name, options) => {
  const ret = {};
  const handlers = {};
  SDK(options).then((sdk) => {
    const Hypercore = sdk.Hypercore;
    let callbacks = [];
    const discoveryCore = new Hypercore(name)
    console.log({diskey:discoveryCore.key.toString('hex')});
    const on = (type, message, peer) => {
      if (handlers[type]) {
        for (hi in handlers[type]) {
          try {
            
            handlers[type][hi](message, async (output) => {
              extension.send(output, peer);
            });
          } catch (e) {
            console.error(e);
            delete handlers[type][hi]
          }
        }
      }
    }
    const extension = discoveryCore.registerExtension('discovery', {
      encoding: 'binary',
      onmessage: (msg, peer) => {
        const data = packr.unpack(msg);
        console.log({data})
        const message = packr.unpack(data.m);
        const type = data.t;
        on(type, message, peer)
      }
    })
    const extension = discoveryCore.registerExtension('done', {
      encoding: 'binary',
      onmessage: (msg, peer) => {
        const data = packr.unpack(msg);
        console.log({data})
        const message = packr.unpack(data.m);
        callbacks[id].cb(message, peer);
        delete callbacks[id];
      }
    })
    peers = [];
    discoveryCore.on("peer-add", peer => {
      peers.push(peer);
    });

    for(let call in callbacks) {
      const time = new Date().getTime();
      if(time - callbacks[call].t > 60000) delete callbacks[call];
    }
    function genHexString(len) {
      const hex = '0123456789ABCDEF';
      let output = '';
      for (let i = 0; i < len; ++i) {
          output += hex.charAt(Math.floor(Math.random() * hex.length));
      }
      return output;
    }
    ret.emit = (type, message, cb) => {
      on(type,message)
      for (let peer in peers) {
        try {
          const i = genHexString(30);
          if(cb) callbacks[i]={cb, t:new Date().getTime()};
          extension.send(packr.pack({m:message,t:type, i}), peers[peer]);
        } catch (e) {
          delete peers[peer];
        }
      }
    };
    ret.close = sdk.close;
  });
  ret.on = (type,cb) => {
    handlers[type] = handlers[type] || [];
    handlers[type].push((msg)=>{
      cb(msg)
    });
  };

  return ret;
}
