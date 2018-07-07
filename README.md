# earl


Pure JavaScript ETF encoder/decoder

```js
const { pack, unpack } = require('earl');

const buf = pack({ a: 1n });

console.log(unpack(buf)); // { a : 1n }
```

