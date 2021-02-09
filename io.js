const { Packr } = require('msgpackr');
let packr = new Packr();

exports.read = async (ipfs, p) => {
    const chunks = [];
    //console.log("READING:",p)
    for await (const chunk of ipfs.files.read(p)) {
      chunks.push(chunk);
    }
    return packr.unpack(Buffer.concat(chunks));
  };
  exports.write = async (ipfs, p, input) => {
    return await ipfs.files.write(p, packr.pack(input), {
      create: true,
      parents: true,
      truncate: true,
      flush: true
    });
  };
  