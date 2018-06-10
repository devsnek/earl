'use strict';

// eslint-disable-next-line no-undef
const { TextEncoder } = typeof window !== 'undefined' ? window : require('util');

const {
  FORMAT_VERSION,

  NEW_FLOAT_EXT,
  // BIT_BINARY_EXT,
  // SMALL_INTEGER_EXT,
  // INTEGER_EXT,
  // FLOAT_EXT,
  ATOM_EXT,
  // REFERENCE_EXT,
  // PORT_EXT,
  // PID_EXT,
  // SMALL_TUPLE_EXT,
  // LARGE_TUPLE_EXT,
  NIL_EXT,
  STRING_EXT,
  LIST_EXT,
  // BINARY_EXT,
  SMALL_BIG_EXT,
  LARGE_BIG_EXT,
  // NEW_FUN_EXT,
  // EXPORT_EXT,
  // NEW_REFERENCE_EXT,
  SMALL_ATOM_EXT,
  MAP_EXT,
  // FUN_EXT,
  // COMPRESSED,
} = require('./constants');

/* eslint-disable no-plusplus */

const LARGE_BIG_CUTOFF = (2n ** 64n) - 1n;

class Encoder {
  constructor() {
    this.buffer = new Uint8Array(1024 * 1024);
    this.view = new DataView(this.buffer.buffer);
    this.buffer[0] = FORMAT_VERSION;
    this.offset = 1;
  }

  appendAtom(atom) {
    const a = new TextEncoder().encode(atom);
    this.buffer[this.offset++] = atom.length > 4 ? ATOM_EXT : SMALL_ATOM_EXT;
    this.buffer[this.offset++] = a.length;
    for (let i = 0; i < a.length; i += 1) {
      this.buffer[this.offset++] = a[i];
    }
  }

  pack(value) {
    if (value == null) {
      this.appendAtom('nil');
      return;
    }

    if (typeof value === 'boolean') {
      this.appendAtom(value ? 'true' : 'false');
      return;
    }

    if (typeof value === 'number') {
      this.buffer[this.offset++] = NEW_FLOAT_EXT;
      this.view.setFloat64(this.offset, value);
      this.offset += 8;
      return;
    }

    if (typeof value === 'bigint') { // eslint-disable-line valid-typeof
      const sign = value > 0n ? 0 : 1;
      let ull = sign === 1 ? -value : value;
      let bytesEnc = 0;
      const chunks = [];
      while (ull > 0) {
        chunks[bytesEnc++] = ull & 0xFFn;
        ull >>= 8n;
      }
      if (value > LARGE_BIG_CUTOFF || value < -LARGE_BIG_CUTOFF) {
        this.buffer[this.offset++] = LARGE_BIG_EXT;
        this.view.setUint32(this.offset, bytesEnc);
        this.offset += 4;
      } else {
        this.buffer[this.offset++] = SMALL_BIG_EXT;
        this.view.setUint8(this.offset, bytesEnc);
        this.offset += 1;
      }
      this.buffer[this.offset++] = sign;
      chunks.forEach((chunk) => {
        this.buffer[this.offset++] = Number(chunk);
      });
      return;
    }

    if (typeof value === 'string') {
      this.buffer[this.offset++] = STRING_EXT;
      this.view.setUint16(this.offset, value.length);
      this.offset += 2;
      const a = new TextEncoder().encode(value);
      for (let i = 0; i < a.length; i += 1) {
        this.buffer[this.offset++] = a[i];
      }
      return;
    }

    if (Array.isArray(value)) {
      const { length } = value;

      if (length === 0) {
        this.buffer[this.offset++] = NIL_EXT;
        return;
      }

      this.buffer[this.offset++] = LIST_EXT;
      this.view.setUint32(this.offset, length);
      this.offset += 4;

      value.forEach((v) => {
        this.pack(v);
      });

      this.buffer[this.offset++] = NIL_EXT;
      return;
    }

    if (typeof value === 'object') {
      const properties = Object.getOwnPropertyNames(value);
      this.buffer[this.offset++] = MAP_EXT;
      this.view.setUint32(this.offset, properties.length);
      this.offset += 4;

      properties.forEach((p) => {
        this.pack(p);
        this.pack(value[p]);
      });

      return;
    }

    throw new Error('could not pack value');
  }
}

module.exports = Encoder;
