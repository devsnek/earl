'use strict';

const Encoder = require('./encoder');
const Decoder = require('./decoder');

module.exports = {
  pack: (v) => {
    const encoder = new Encoder();
    encoder.pack(v);
    return encoder.buffer.slice(0, encoder.offset);
  },
  packTuple: (v) => {
    const encoder = new Encoder();
    encoder.packTuple(v);
    return encoder.buffer.slice(0, encoder.offset);
  },
  unpack: (v, { bigintToString = false } = {}) => {
    const decoder = new Decoder(v, bigintToString);
    return decoder.unpack();
  },
};
