'use strict';

const {
  FORMAT_VERSION,

  NEW_FLOAT_EXT,
  // BIT_BINARY_EXT,
  SMALL_INTEGER_EXT,
  INTEGER_EXT,
  FLOAT_EXT,
  ATOM_EXT,
  ATOM_UTF8_EXT,
  // REFERENCE_EXT,
  // PORT_EXT,
  NEW_PID_EXT,
  // PID_EXT,
  SMALL_TUPLE_EXT,
  LARGE_TUPLE_EXT,
  NIL_EXT,
  STRING_EXT,
  LIST_EXT,
  BINARY_EXT,
  SMALL_BIG_EXT,
  LARGE_BIG_EXT,
  // NEW_FUN_EXT,
  // EXPORT_EXT,
  // NEW_REFERENCE_EXT,
  NEWER_REFERENCE_EXT,
  SMALL_ATOM_EXT,
  SMALL_ATOM_UTF8_EXT,
  MAP_EXT,
  // FUN_EXT,
  // COMPRESSED,
} = require('./constants');
const { Atom } = require('./atom');

const textDecoder = new TextDecoder();

const processAtom = (atom, atomToString) => {
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

  if (atomToString) {
    return atom;
  }
  return Atom(atom);
};

module.exports = class Decoder {
  constructor(buffer, { bigintToString, atomToString } = {}) {
    if (ArrayBuffer.isView(buffer)) {
      this.buffer = buffer;
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      this.buffer = new Uint8Array(buffer);
      this.view = new DataView(buffer);
    }
    this.offset = 0;

    this.bigintToString = bigintToString;
    this.atomToString = atomToString;

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

  readi8() {
    const val = this.view.getInt8(this.offset);
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

  readi32() {
    const val = this.view.getInt32(this.offset);
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
    const str = textDecoder.decode(sub);
    this.offset += length;
    return str;
  }

  decodeArray(length) {
    const array = [];
    for (let i = 0; i < length; i += 1) {
      array.push(this.unpack());
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
      b <<= 8;
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

  decodeBigInt(digits) {
    const sign = this.read8();

    let value = 0n;
    let b = 1n;

    for (let i = 0; i < digits; i += 1) {
      const digit = BigInt(this.read8());
      value += digit * b;
      b <<= 8n;
    }

    const v = sign === 0 ? value : -value;
    if (this.bigintToString) {
      return v.toString();
    }
    return v;
  }

  decodeAtom(type) {
    type = type ?? this.read8();
    if (type === SMALL_ATOM_EXT || type === SMALL_ATOM_UTF8_EXT) {
      return processAtom(this.readString(this.read8()), this.atomToString);
    }
    if (type === ATOM_EXT || type === ATOM_UTF8_EXT) {
      return processAtom(this.readString(this.read16()), this.atomToString);
    }
    throw new RangeError(`unknown atom type ${type}`);
  }

  unpack() {
    const type = this.read8();
    switch (type) {
      case SMALL_INTEGER_EXT:
        return this.readi8();
      case INTEGER_EXT:
        return this.readi32();
      case FLOAT_EXT:
        return Number.parseFloat(this.readString(31));
      case NEW_FLOAT_EXT:
        return this.readDouble();
      case ATOM_EXT:
      case ATOM_UTF8_EXT:
      case SMALL_ATOM_EXT:
      case SMALL_ATOM_UTF8_EXT:
        return this.decodeAtom(type);
      case SMALL_TUPLE_EXT:
        return this.decodeArray(this.read8());
      case LARGE_TUPLE_EXT:
        return this.decodeArray(this.read32());
      case NIL_EXT:
        return [];
      case STRING_EXT: {
        const length = this.read16();
        const sub = this.buffer.subarray(this.offset, this.offset + length);
        this.offset += length;
        return [...sub];
      }
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
        return digits >= 7 ? this.decodeBigInt(digits) : this.decodeBigNumber(digits);
      }
      case LARGE_BIG_EXT: {
        const digits = this.read32();
        return this.decodeBigInt(digits);
      }
      case NEW_PID_EXT:
        return {
          node: this.decodeAtom(),
          id: this.read32(),
          serial: this.read32(),
          creation: this.read32(),
        };
      case NEWER_REFERENCE_EXT: {
        const len = this.read16();
        const node = this.decodeAtom();
        const creation = this.read32();
        const id = [];
        for (let i = 0; i < len; i += 1) {
          id.push(this.read32());
        }
        return {
          node,
          creation,
          id,
        };
      }
      default:
        throw new Error(`unsupported etf type ${type}`);
    }
  }
};
