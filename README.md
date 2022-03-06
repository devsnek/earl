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

#### `Atom`

```js
const { pack, Atom } = require('@earl');

const hello = Atom('hello');

const buf = pack([hello, moreData]); // uses ATOM_UTF8_EXT instead of BINARY_EXT
```

`Atoms` return an opaque value which is referentially equal based on the name.
Similarly to Erlang, atoms create additional memory pressure, so take care to
not create them from arbitrary input.
