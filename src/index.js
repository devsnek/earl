'use strict';

const Encoder = require('./encoder');
const Decoder = require('./decoder');

module.exports = {
  pack: (v) => {
    const encoder = new Encoder();
    encoder.pack(v);
    return encoder.buffer.slice(0, encoder.offset);
  },
  unpack: (v) => {
    const decoder = new Decoder(v);
    return decoder.unpack();
  },
};
