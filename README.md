# erlpackjs

Pure JavaScript ETF encoder/decoder

```js
const erlpack = require('erlpackjs');

const buf = erlpack.pack({ a: 1n });

console.log(erlpack.unpack(buf)); // { a : 1n }
```
