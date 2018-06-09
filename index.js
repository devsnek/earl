'use strict';

const { pack, unpack } = require('bindings')('earl');

const kPackCustom = Symbol('earl.pack.custom');
const symbolToString = (s) => s.toString().slice(7, -1);

module.exports = {
  pack: (v) => {
    if (v[kPackCustom]) {
      return pack(v[kPackCustom]);
    }
    return pack(v, symbolToString);
  },
  unpack: (v) => {
    if (typeof v !== 'object') {
      throw new Error('Cannot unpack a non-object.');
    }

    return unpack(v);
  },
};

module.exports.pack.custom = kPackCustom;
