'use strict';

const Encoder = require('./encoder');
const Decoder = require('./decoder');
const { Atom } = require('./atom');

module.exports = {
  pack: (v) => {
    const encoder = new Encoder();
    encoder.pack(v);
    return encoder.buffer.subarray(0, encoder.offset);
  },
  packTuple: (v) => {
    const encoder = new Encoder();
    encoder.packTuple(v);
    return encoder.buffer.subarray(0, encoder.offset);
  },
  unpack: (v, { bigintToString = false, atomToString = true } = {}) => {
    const decoder = new Decoder(v, { bigintToString, atomToString });
    return decoder.unpack();
  },
  Atom,
};
