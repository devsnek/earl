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
} = require('@devsnek/fuzzy');
const { deepStrictEqual } = require('assert');
const { pack, unpack } = require('.');

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
  ],
});

for (let i = 0; i < 100; i += 1) {
  const v = value();
  const packed = pack(v);
  const unpacked = unpack(packed);
  deepStrictEqual(unpacked, v);
}
