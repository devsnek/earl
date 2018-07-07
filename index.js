'use strict';

const Encoder = require('./src/encoder');
const Decoder = require('./src/decoder');

module.exports = {
  pack: (v) => {
    const encoder = new Encoder();
    encoder.pack(v);
    return encoder.buffer.subarray(0, encoder.offset);
  },
  unpack: (v) => {
    const decoder = new Decoder(v);
    return decoder.unpack();
  },
};
