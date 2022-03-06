'use strict';

const ATOMS = new Map();

const registry = new FinalizationRegistry((key) => {
  ATOMS.delete(key);
});

const SYNTAX_RE = /^[0-9a-zA-Z$_\p{ID_Start}][0-9a-zA-Z$@_\p{ID_Continue}]*$/u;

class RegisteredAtom {
  constructor(name) {
    this.name = name;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    if (!SYNTAX_RE.test(this.name)) {
      return `:"${this.name}"`;
    }
    return `:${this.name}`;
  }
}

function Atom(name) {
  const existing = ATOMS.get(name)?.deref();
  if (existing !== undefined) {
    return existing;
  }

  const atom = new RegisteredAtom(name);
  ATOMS.set(name, new WeakRef(atom));
  registry.register(atom, name);
  return atom;
}

module.exports = { Atom, RegisteredAtom };
