# earl

JavaScript wrapper for [erlpack][]

```js
const { pack, unpack } = require('earl');

const buf = pack({ a: 1n });

console.log(unpack(buf)); // { a : 1n }
```

```js
const { pack } = require('earl');

class User {
  constructor(data) {
    this.name = data.name;
    this.id = data.id;
  }

  [pack.custom]() {
    return this.id;
  }
}

const u = new User({ name: 'Tom', id: '1234' });
const buf = pack(u);

console.log(unpack(buf)) // '1234'
```

[erlpack]: https://github.com/discordapp/erlpack
