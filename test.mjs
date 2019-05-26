import random, {
  undefined as fuzzyUndefined,
  function as fuzzyFunction, symbol, error,
  date,
  regexp,
  typedArray,
  map, set, weakMap, weakSet,
  arrayBuffer, json,
  generatorFunction, generator, promise, asyncFunction,
  proxy,
} from '@devsnek/fuzzy';
import { deepStrictEqual } from 'assert';
import earl from './index.js';

const value = () => random({
  exclude: [
    fuzzyUndefined,
    fuzzyFunction, symbol, error,
    date,
    regexp,
    typedArray,
    map, set, weakMap, weakSet,
    arrayBuffer, json,
    generatorFunction, generator, promise, asyncFunction,
    proxy,
  ],
});

for (let i = 0; i < 10; i += 1) {
  const v = value();
  const packed = earl.pack(v);
  const unpacked = earl.unpack(packed);
  deepStrictEqual(unpacked, v);
}
