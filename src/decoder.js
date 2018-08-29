'use strict';

// eslint-disable-next-line no-undef
const { TextDecoder } = typeof window !== 'undefined' ? window : require('util');

const {
  FORMAT_VERSION,

  NEW_FLOAT_EXT,
  // BIT_BINARY_EXT,
  SMALL_INTEGER_EXT,
  INTEGER_EXT,
  FLOAT_EXT,
  ATOM_EXT,
  REFERENCE_EXT,
  PORT_EXT,
  PID_EXT,
  SMALL_TUPLE_EXT,
  LARGE_TUPLE_EXT,
  NIL_EXT,
  STRING_EXT,
  LIST_EXT,
  BINARY_EXT,
  SMALL_BIG_EXT,
  LARGE_BIG_EXT,
  // NEW_FUN_EXT,
  EXPORT_EXT,
  NEW_REFERENCE_EXT,
  SMALL_ATOM_EXT,
  MAP_EXT,
  // FUN_EXT,
  // COMPRESSED,
} = require('./constants');

const processAtom = (atom) => {
  if (!atom) {
    return undefined;
  }

  if (atom === 'nil' || atom === 'null') {
    return null;
  }

  if (atom === 'true') {
    return true;
  }

  if (atom === 'false') {
    return false;
  }

  return atom;
};

module.exports = class Decoder {
  constructor(buffer) {
    this.buffer = new Uint8Array(buffer);
    this.view = new DataView(this.buffer.buffer);
    this.offset = 0;
    this.decoder = new TextDecoder('utf8');

    const version = this.read8();
    if (version !== FORMAT_VERSION) {
      throw new Error('invalid version header');
    }
  }

  read8() {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  read16() {
    const val = this.view.getUint16(this.offset);
    this.offset += 2;
    return val;
  }

  read32() {
    const val = this.view.getUint32(this.offset);
    this.offset += 4;
    return val;
  }

  readDouble() {
    const val = this.view.getFloat64(this.offset);
    this.offset += 8;
    return val;
  }

  readString(length) {
    const sub = this.buffer.subarray(this.offset, this.offset + length);
    const str = this.decoder.decode(sub);
    this.offset += length;
    return str;
  }

  decodeArray(length) {
    const array = new Array(length);
    for (let i = 0; i < length; i += 1) {
      array[i] = this.unpack();
    }
    return array;
  }

  decodeBigNumber(digits) {
    const sign = this.read8();

    let value = 0;
    let b = 1;

    for (let i = 0; i < digits; i += 1) {
      const digit = this.read8();
      value += digit * b;
      b = Number(BigInt(b) << 8n);
    }

    if (digits < 4) {
      if (sign === 0) {
        return value;
      }

      const isSignBitAvailable = (value & (1 << 31)) === 0;
      if (isSignBitAvailable) {
        return -value;
      }
    }

    return sign === 0 ? value : -value;
  }

  decodeBigBigInt(digits) {
    const sign = this.read8();

    let value = 0n;
    let b = 1n;

    for (let i = 0; i < digits; i += 1) {
      const digit = this.read8();
      value += BigInt(digit) * b;
      b <<= 8n;
    }

    return sign === 0 ? value : -value;
  }

  unpack() {
    const type = this.read8();
    switch (type) {
      case SMALL_INTEGER_EXT:
        return this.read8();
      case INTEGER_EXT:
        return this.read32();
      case FLOAT_EXT:
        return Number.parseFloat(this.readString(31));
      case NEW_FLOAT_EXT:
        return this.readDouble();
      case ATOM_EXT:
        return processAtom(this.readString(this.read16()));
      case SMALL_ATOM_EXT:
        return processAtom(this.readString(this.read8()));
      case SMALL_TUPLE_EXT:
        return this.decodeArray(this.read8());
      case LARGE_TUPLE_EXT:
        return this.decodeArray(this.read32());
      case NIL_EXT:
        return [];
      case STRING_EXT:
        return this.readString(this.read16());
      case LIST_EXT: {
        const length = this.read32();
        const array = this.decodeArray(length);
        if (this.read8() !== NIL_EXT) {
          throw new Error('expected tail marker after list');
        }
        return array;
      }
      case MAP_EXT: {
        const length = this.read32();
        const map = {};
        for (let i = 0; i < length; i += 1) {
          map[this.unpack()] = this.unpack();
        }
        return map;
      }
      case BINARY_EXT: {
        const length = this.read32();
        return this.readString(length);
      }
      case SMALL_BIG_EXT: {
        const digits = this.read8();
        return digits >= 7 ? this.decodeBigBigInt(digits) : this.decodeBigNumber(digits);
      }
      case LARGE_BIG_EXT: {
        const digits = this.read32();
        return this.decodeBigBigInt(digits);
      }
      case REFERENCE_EXT:
        return {
          node: this.unpack(),
          id: [this.read32()],
          creation: this.read8(),
        };
      case NEW_REFERENCE_EXT: {
        const length = this.read16();
        return {
          node: this.unpack(),
          creation: this.read8(),
          ids: Array.from({ length }, () => this.read32()),
        };
      }
      case PORT_EXT:
        return {
          node: this.unpack(),
          id: this.read32(),
          creation: this.read8(),
        };
      case PID_EXT:
        return {
          node: this.unpack(),
          id: this.read32(),
          serial: this.read32(),
          creation: this.read8(),
        };
      case EXPORT_EXT:
        return {
          mod: this.unpack(),
          fun: this.unpack(),
          arity: this.unpack(),
        };
      default:
        throw new Error('unsupported etf type');
    }
  }
};
