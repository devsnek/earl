'use strict';

class Tuple extends Array {}

function tuple(...items) {
  return Reflect.construct(Tuple, items);
}

class Pid {
  constructor(node, id, serial, creation) {
    this.node = node;
    this.id = id;
    this.serial = serial;
    this.creation = creation;
  }

  eq(other) {
    return other instanceof Pid
      && other.node === this.node
      && other.id === this.id
      && other.serial === this.serial
      && other.creation === this.creation;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `#Pid<${this.node}.${this.id}.${this.serial}.${this.creation}>`;
  }
}

class Reference {
  constructor(node, creation, id) {
    this.node = node;
    this.creation = creation;
    this.id = id;
  }

  eq(other) {
    return other instanceof Reference
      && other.node === this.node
      && other.creation === this.creation
      && `${other.id}` === `${this.id}`;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `#Ref<${this.node} ${this.creation} 0x${Buffer.from(this.id).toString('hex')}>`;
  }
}

class ImproperList {
  constructor(head, tail) {
    this.head = head;
    this.tail = tail;
  }
}

module.exports = {
  Tuple,
  tuple,
  Reference,
  Pid,
  ImproperList,
};
