'use strict';

const {
  random,
  undefined: fuzzyUndefined,
  function: fuzzyFunction,
  symbol, error,
  date,
  regexp,
  typedArray,
  map, set, weakMap, weakSet,
  arrayBuffer, json,
  promise,
  proxy,
  bigint,
} = require('@devsnek/fuzzy');
const { deepStrictEqual } = require('assert');
const erlpack = require('erlpack');
const {
  FORMAT_VERSION,
  STRING_EXT,
  SMALL_BIG_EXT,
  SMALL_INTEGER_EXT,
  SMALL_TUPLE_EXT,
  LARGE_TUPLE_EXT,
  SMALL_ATOM_EXT,
  SMALL_ATOM_UTF8_EXT,
} = require('./src/constants');
const earl = require('.');

const value = () => random({
  exclude: [
    fuzzyUndefined,
    fuzzyFunction, symbol, error,
    date,
    regexp,
    typedArray,
    map, set, weakMap, weakSet,
    arrayBuffer, json,
    promise,
    proxy,
    bigint,
  ],
});

[
  0n,
  1n,
  -1n,
  1n << 32n,
  1n << 64n,
  1n << 128n,
  -(1n << 32n),
  -(1n << 64n),
  -(1n << 128n),
  -1,
  0,
  1,
  2 ** 32,
  2 ** 31,
  -(2 ** 32),
  -(2 ** 31),
].forEach((v) => {
  const packed = earl.pack(v);
  const unpacked = earl.unpack(packed);
  deepStrictEqual(unpacked, v);

  if (typeof v === 'bigint') {
    const unpackedS = earl.unpack(packed, { bigintToString: true });
    deepStrictEqual(unpackedS, v.toString());
  }
});

[
  [
    [
      STRING_EXT,
      0x2, 0x0,
      42,
      43,
    ],
    [42, 43],
  ],
  [
    [
      SMALL_BIG_EXT,
      1,
      0, 1,
    ],
    1,
  ],
  [
    [
      SMALL_BIG_EXT,
      1,
      1, 1,
    ],
    -1,
  ],
  [
    [
      SMALL_BIG_EXT,
      5,
      0, 1, 1, 1, 1, 1,
    ],
    16843009,
  ],
  [
    [
      SMALL_BIG_EXT,
      5,
      1, 1, 1, 1, 1, 1,
    ],
    -16843009,
  ],
  [
    [
      SMALL_BIG_EXT,
      10,
      0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ],
    4740885567116192841985n,
  ],
  [
    [
      SMALL_TUPLE_EXT,
      1,
      SMALL_INTEGER_EXT,
      42,
    ],
    [42],
  ],
  [
    [
      LARGE_TUPLE_EXT,
      0, 0, 0, 1,
      SMALL_INTEGER_EXT,
      42,
    ],
    [42],
  ],
].forEach(([raw, v]) => {
  const packed = Buffer.from([FORMAT_VERSION, ...raw]);
  const unpacked = earl.unpack(packed);
  deepStrictEqual(unpacked, v);
});

{
  const packed = earl.packTuple([1, 2, 3]);

  deepStrictEqual(packed, new Uint8Array([
    FORMAT_VERSION,
    SMALL_TUPLE_EXT,
    3,
    SMALL_INTEGER_EXT,
    1,
    SMALL_INTEGER_EXT,
    2,
    SMALL_INTEGER_EXT,
    3,
  ]));

  deepStrictEqual(earl.unpack(packed), [1, 2, 3]);
}

{
  const packed = earl.pack(Symbol('hello'));

  deepStrictEqual(packed, new Uint8Array([
    FORMAT_VERSION,
    SMALL_ATOM_EXT,
    5,
    104,
    101,
    108,
    108,
    111,
  ]));

  deepStrictEqual(earl.unpack(packed), 'hello');
}

{
  const packed = earl.pack(Symbol('a🧪b'));

  deepStrictEqual(packed, new Uint8Array([
    FORMAT_VERSION,
    SMALL_ATOM_UTF8_EXT,
    6,
    97,
    240,
    159,
    167,
    170,
    98,
  ]));

  deepStrictEqual(earl.unpack(packed), 'a🧪b');
}

// Fuzz testing
for (let i = 0; i < 10000; i += 1) {
  const v = value();
  {
    const packed = earl.pack(v);
    const unpacked = erlpack.unpack(packed);
    deepStrictEqual(unpacked, v);
  }
  {
    const packed = erlpack.pack(v);
    const unpacked = earl.unpack(packed);
    deepStrictEqual(unpacked, v);
  }
}
