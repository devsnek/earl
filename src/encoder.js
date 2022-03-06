'use strict';

// eslint-disable-next-line no-undef
const { TextEncoder } = typeof window !== 'undefined' ? window : require('util');

const {
  FORMAT_VERSION,

  NEW_FLOAT_EXT,
  // BIT_BINARY_EXT,
  SMALL_INTEGER_EXT,
  INTEGER_EXT,
  // FLOAT_EXT,
  ATOM_EXT,
  // REFERENCE_EXT,
  // PORT_EXT,
  // PID_EXT,
  SMALL_TUPLE_EXT,
  LARGE_TUPLE_EXT,
  NIL_EXT,
  // STRING_EXT,
  LIST_EXT,
  BINARY_EXT,
  // SMALL_BIG_EXT,
  LARGE_BIG_EXT,
  // NEW_FUN_EXT,
  // EXPORT_EXT,
  // NEW_REFERENCE_EXT,
  SMALL_ATOM_EXT,
  MAP_EXT,
  // FUN_EXT,
  // COMPRESSED,
} = require('./constants');

const BUFFER_CHUNK = 2048;

class Encoder {
  constructor() {
    this.buffer = new Uint8Array(BUFFER_CHUNK);
    this.view = new DataView(this.buffer.buffer);
    this.encoder = new TextEncoder();
    this.buffer[0] = FORMAT_VERSION;
    this.offset = 1;
  }

  grow(length) {
    if (this.offset + length < this.buffer.length) {
      return;
    }
    const chunks = Math.ceil(length / BUFFER_CHUNK) * BUFFER_CHUNK;
    const old = this.buffer;
    this.buffer = new Uint8Array(old.length + chunks);
    this.buffer.set(old);
    this.view = new DataView(this.buffer.buffer);
  }

  write(v) {
    this.grow(v.length);
    this.buffer.set(v, this.offset);
    this.offset += v.length;
  }

  write8(v) {
    this.grow(1);
    this.view.setUint8(this.offset, v);
    this.offset += 1;
  }

  write16(v) {
    this.grow(2);
    this.view.setUint16(this.offset, v);
    this.offset += 2;
  }

  write32(v) {
    this.grow(4);
    this.view.setUint32(this.offset, v);
    this.offset += 4;
  }

  writeFloat(v) {
    this.grow(8);
    this.view.setFloat64(this.offset, v);
    this.offset += 8;
  }

  appendAtom(atom) {
    const a = this.encoder.encode(atom);
    if (a.length < 255) {
      this.write8(SMALL_ATOM_EXT);
      this.write8(a.length);
    } else {
      this.write8(ATOM_EXT);
      this.write16(a.length);
    }
    this.write(a);
  }

  pack(value) {
    if (value === null || value === undefined) {
      this.appendAtom('nil');
      return;
    }

    if (typeof value === 'boolean') {
      this.appendAtom(value ? 'true' : 'false');
      return;
    }

    if (typeof value === 'number') {
      if ((value | 0) === value) {
        if (value > -128 && value < 128) {
          this.write8(SMALL_INTEGER_EXT);
          this.write8(value);
        } else {
          this.write8(INTEGER_EXT);
          this.write32(value);
        }
      } else {
        this.write8(NEW_FLOAT_EXT);
        this.writeFloat(value);
      }
      return;
    }

    if (typeof value === 'bigint') {
      this.write8(LARGE_BIG_EXT);

      const byteCountIndex = this.offset;
      this.offset += 4;

      this.write8(value < 0n ? 1 : 0);

      let ull = value < 0n ? -value : value;
      let byteCount = 0;
      while (ull > 0) {
        byteCount += 1;
        this.write8(Number(ull & 0xFFn));
        ull >>= 8n;
      }

      this.view.setUint32(byteCountIndex, byteCount);
      return;
    }

    if (typeof value === 'string') {
      this.write8(BINARY_EXT);
      const a = this.encoder.encode(value);
      this.write32(a.length);
      this.write(a);
      return;
    }

    if (Array.isArray(value)) {
      if (array.length === 0) {
        this.write8(NIL_EXT);
        return;
      }

      this.write8(LIST_EXT);
      this.write32(array.length);

      value.forEach((v) => {
        this.pack(v);
      });

      this.write8(NIL_EXT);
      return;
    }

    if (typeof value === 'object') {
      this.write8(MAP_EXT);

      const properties = Object.keys(value);

      this.write32(properties.length);

      properties.forEach((p) => {
        this.pack(p);
        this.pack(value[p]);
      });

      return;
    }

    throw new Error('could not pack value');
  }

  packTuple(array) {
    if (!Array.isArray(array)) {
      throw new Error('could not pack value');
    }

    if (array.length > 255) {
      this.write8(LARGE_TUPLE_EXT);
      this.write32(array.length);
    } else {
      this.write8(SMALL_TUPLE_EXT);
      this.write8(array.length);
    }

    array.forEach((v) => {
      this.pack(v);
    });
  }
}

module.exports = Encoder;
