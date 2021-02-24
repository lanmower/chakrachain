const RAF = require('random-access-file')

let lock = null

try {
  lock = require('fd-lock')
} catch (_) {}

module.exports = defaultStorage

function defaultStorage (name, opts) {
  // make it easier to cache tree nodes without the big unsafe arraybuffer attached
  if (isTree(name)) return new RAF(name, { alloc: Buffer.alloc, ...opts })
  if (!isBitfield(name)) return new RAF(name, opts)
  return new RAF(name, { lock, ...opts })
}

function isTree (name) {
  return name === 'tree' || name.endsWith('/tree')
}

function isBitfield (name) {
  return name === 'bitfield' || name.endsWith('/bitfield')
}
