import constants from './constants';

const { TextDecoder } =
    typeof window !== 'undefined' ? window : require('util');
const {
    FORMAT_VERSION,
    NEW_FLOAT_EXT,
    SMALL_INTEGER_EXT,
    INTEGER_EXT,
    FLOAT_EXT,
    ATOM_EXT,
    SMALL_TUPLE_EXT,
    LARGE_TUPLE_EXT,
    NIL_EXT,
    STRING_EXT,
    LIST_EXT,
    BINARY_EXT,
    SMALL_BIG_EXT,
    LARGE_BIG_EXT,
    SMALL_ATOM_EXT,
    MAP_EXT,
} = constants;

const processAtom = (atom: any) => {
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

export default class Decoder {
    buffer: Uint8Array;

    view: DataView;

    offset: number;

    decoder: TextDecoder;

    bigintToString: boolean;

    constructor(buffer: Iterable<number>, bigintToString: boolean) {
        this.buffer = new Uint8Array(buffer);
        this.view = new DataView(this.buffer.buffer);
        this.offset = 0;
        this.decoder = new TextDecoder('utf8');
        this.bigintToString = bigintToString;

        const version = this.read8();

        if (version !== FORMAT_VERSION) {
            throw new Error('invalid version header');
        }
    }

    read8() {
        const val = this.view.getUint8(this.offset);

        this.offset++;

        return val;
    }

    readi8() {
        const val = this.view.getInt8(this.offset);

        this.offset++;

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

    readString(length: number) {
        const sub = this.buffer.subarray(this.offset, this.offset + length);
        const str = this.decoder.decode(sub);

        this.offset += length;

        return str;
    }

    decodeArray(length: number) {
        const array = [];

        for (let i = 0; i < length; i++) {
            array.push(this.unpack());
        }

        return array;
    }

    decodeBigNumber(digits: number) {
        const sign = this.read8();

        let value = 0;
        let b = 1;

        for (let i = 0; i < digits; i++) {
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

    decodeBigInt(digits: number) {
        const sign = this.read8();

        let value = 0n;
        let b = 1n;

        for (let i = 0; i < digits; i++) {
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

    unpack(): any {
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
                return processAtom(this.readString(this.read16()));
            case SMALL_ATOM_EXT:
                return processAtom(this.readString(this.read8()));
            case SMALL_TUPLE_EXT:
                return this.decodeArray(this.read8());
            case LARGE_TUPLE_EXT:
                return this.decodeArray(this.read32());
            case NIL_EXT:
                return [];
            case STRING_EXT: {
                const length = this.read16();
                const sub = this.buffer.subarray(
                    this.offset,
                    this.offset + length,
                );

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
                const map: Record<any, any> = {};

                for (let i = 0; i < length; i++) {
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

                return digits >= 7
                    ? this.decodeBigInt(digits)
                    : this.decodeBigNumber(digits);
            }
            case LARGE_BIG_EXT: {
                const digits = this.read32();

                return this.decodeBigInt(digits);
            }
            default:
                throw new Error(`unsupported etf type ${type}`);
        }
    }
}
