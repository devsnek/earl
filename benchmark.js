'use strict';

const Benchmark = require('benchmark');
// const erlpack = require('erlpack');
const earl = require('.');

const STRUCTURE = {
  a: [1, 2, 'hi'],
  b: {
    c: 'memes',
    d: [
      12.5,
      2417298371923812,
      '123971293817293817293',
    ],
  },
};

const PACKED = earl.pack(STRUCTURE);

new Benchmark.Suite()
  // .add('erlpack.unpack', () => erlpack.unpack(PACKED))
  .add('earl.unpack', () => earl.unpack(PACKED))
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', function x() {
    console.log(`Fastest is ${this.filter('fastest').map('name')}`);
  })
  .run();

new Benchmark.Suite()
  // .add('erlpack.pack', () => erlpack.pack(STRUCTURE))
  .add('earl.pack', () => earl.pack(STRUCTURE))
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', function x() {
    console.log(`Fastest is ${this.filter('fastest').map('name')}`);
  })
  .run();
