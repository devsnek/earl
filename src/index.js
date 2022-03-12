'use strict';

const Encoder = require('./encoder');
const Decoder = require('./decoder');
const { tuple, Reference, Pid, ImproperList } = require('./special');

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
  unpack: (
    v,
    {
      bigintToString = false,
      atomToString = true,
      mapToObject = true,
      returnSize = false,
    } = {},
  ) => {
    const decoder = new Decoder(v, { bigintToString, atomToString, mapToObject });
    const value = decoder.unpack();
    if (returnSize) {
      return { value, size: decoder.offset };
    }
    return value;
  },
  tuple,
  Reference,
  Pid,
  ImproperList,
};
