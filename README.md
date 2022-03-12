# earl

Pure JavaScript ETF encoder/decoder

```js
const { pack, unpack } = require('@earl');

const buf = pack({ a: 1n });

console.log(unpack(buf)); // { a : 1n }
```

### Additional APIs for Erlang/OTP Compat

#### `packTuple`

```js
const { packTuple } = require('@earl');

const buf = packTuple([1, 2, 3]); // uses TUPLE_EXT instead of LIST_EXT
```
