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
  // SMALL_TUPLE_EXT,
  // LARGE_TUPLE_EXT,
  NIL_EXT,
  // STRING_EXT,
  LIST_EXT,
  BINARY_EXT,
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

const MAX_INT32 = (2 ** 31) - 1;
const BUFFER_CHUNK = 2048;

class Encoder {
  constructor() {
    this.buffer = new Uint8Array(BUFFER_CHUNK);
    this.view = new DataView(this.buffer.buffer);
    this.encoder = new TextEncoder();
    this.buffer[0] = FORMAT_VERSION;
    this._offset = 1;
  }

  grow() {
    const old = this.buffer;
    this.buffer = new Uint8Array(old.length + BUFFER_CHUNK);
    this.buffer.set(old);
    this.view = new DataView(this.buffer.buffer);
  }

  set offset(v) {
    this._offset = v;
    if (this._offset >= this.buffer.length) {
      this.grow();
    }
  }

  get offset() {
    return this._offset;
  }

  appendAtom(atom) {
    const a = this.encoder.encode(atom);
    if (atom.length > 4) {
      this.buffer[this.offset++] = ATOM_EXT;
      this.view.setUint16(this.offset, a.length);
      this.offset += 2;
    } else {
      this.buffer[this.offset++] = SMALL_ATOM_EXT;
      this.buffer[this.offset++] = a.length;
    }
    while (this.offset + a.length > this.buffer.length) {
      this.grow();
    }
    this.buffer.set(a, this.offset);
    this.offset += a.length;
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
      if (value % 1 === 0) {
        if (value >= 0 && value < 256) {
          this.buffer[this.offset++] = SMALL_INTEGER_EXT;
          this.buffer[this.offset++] = value;
        } else if (value < MAX_INT32) {
          this.buffer[this.offset++] = INTEGER_EXT;
          this.view.setUint32(this.offset, value);
          this.offset += 4;
        } else {
          this.buffer[this.offset++] = SMALL_BIG_EXT;

          const byteCountIndex = this.offset;
          this.offset++;

          const sign = value > 0 ? 0 : 1;
          this.buffer[this.offset++] = sign;

          let ull = sign === 1 ? -value : value;
          let byteCount = 0;
          while (ull > 0) {
            byteCount += 1;
            this.buffer[this.offset++] = ull & 0xFF;
            ull >>= 8;
          }
          this.buffer[byteCountIndex] = byteCount;
        }
      } else {
        this.buffer[this.offset++] = NEW_FLOAT_EXT;
        this.view.setFloat64(this.offset, value);
        this.offset += 8;
      }
      return;
    }

    if (typeof value === 'bigint') { // eslint-disable-line valid-typeof
      this.buffer[this.offset++] = LARGE_BIG_EXT;

      const byteCountIndex = this.offset;
      this.offset += 4;

      const sign = value > 0n ? 0 : 1;
      this.buffer[this.offset++] = sign;

      let ull = sign === 1 ? -value : value;
      let byteCount = 0;
      while (ull > 0) {
        byteCount += 1;
        this.buffer[this.offset++] = Number(ull & 0xFFn);
        ull >>= 8n;
      }

      this.view.setUint32(byteCountIndex, byteCount);
      this.offset += 4;
      return;
    }

    if (typeof value === 'string') {
      this.buffer[this.offset++] = BINARY_EXT;
      this.view.setUint32(this.offset, value.length);
      this.offset += 4;
      const a = this.encoder.encode(value);
      while (this.offset + a.length > this.buffer.length) {
        this.grow();
      }
      this.buffer.set(a, this.offset);
      this.offset += a.length;
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
