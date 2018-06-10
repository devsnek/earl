'use strict';

const Encoder = require('./src/encoder');
const Decoder = require('./src/decoder');

const kPackCustom = Symbol('earl.pack.custom');

module.exports = {
  pack: (v) => {
    const encoder = new Encoder();
    encoder.pack(v[kPackCustom] ? v[kPackCustom] : v);
    return encoder.buffer.slice(0, encoder.offset);
  },
  unpack: (v) => {
    const decoder = new Decoder(v);
    return decoder.unpack();
  },
};

module.exports.pack.custom = kPackCustom;
