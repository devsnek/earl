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
