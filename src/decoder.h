#pragma once

#if !defined(__STDC_FORMAT_MACROS)
#define __STDC_FORMAT_MACROS
#endif

#include <v8.h>  // v8::BigInt
#include <napi.h>
#include <zlib.h>
#include <cinttypes>
#include <cstdio>

#include "../deps/erlpack/cpp/sysdep.h"

class Decoder {
 public:
  Decoder(Napi::Uint8Array array) :
    env_(array.Env()),
    data_(array.Data()),
    size_(array.ByteLength()),
    is_invalid_(false),
    offset_(0)
  {
    const auto version = read8();
    if (version != FORMAT_VERSION) {
      Napi::Error::New(env_, "Bad version number.").ThrowAsJavaScriptException();
      is_invalid_ = true;
    }
  }

  Decoder(Napi::Env env, const uint8_t* data, size_t length, bool skip_version = false) :
    env_(env),
    data_(data),
    size_(length),
    is_invalid_(false),
    offset_(0)
  {
    if (!skip_version) {
      const auto version = read8();
      if (version != FORMAT_VERSION) {
        Napi::Error::New(env_, "Bad version number.").ThrowAsJavaScriptException();
        is_invalid_ = true;
      }
    }
  }

  uint8_t read8() {
    if (offset_ + sizeof(uint8_t) > size_) {
      Napi::Error::New(env_, "Read past end of buffer").ThrowAsJavaScriptException();
      return 0;
    }
    auto val = *reinterpret_cast<const uint8_t*>(data_ + offset_);
    offset_ += sizeof(uint8_t);
    return val;
  }

  uint16_t read16() {
    if (offset_ + sizeof(uint16_t) > size_) {
      Napi::Error::New(env_, "Read past end of buffer").ThrowAsJavaScriptException();
      return 0;
    }

    uint16_t val = _erlpack_be16(*reinterpret_cast<const uint16_t*>(data_ + offset_));
    offset_ += sizeof(uint16_t);
    return val;
  }

  uint32_t read32() {
    if (offset_ + sizeof(uint32_t) > size_) {
      Napi::Error::New(env_, "Read past end of buffer").ThrowAsJavaScriptException();
      return 0;
    }

    uint32_t val = _erlpack_be32(*reinterpret_cast<const uint32_t*>(data_ + offset_));
    offset_ += sizeof(uint32_t);
    return val;
  }

  uint64_t read64() {
    if (offset_ + sizeof(uint64_t) > size_) {
      Napi::Error::New(env_, "Read past end of buffer").ThrowAsJavaScriptException();
      return 0;
    }

    uint64_t val = _erlpack_be64(*reinterpret_cast<const uint64_t*>(data_ + offset_));
    offset_ += sizeof(val);
    return val;
  }

  const char* readString(uint32_t length) {
    if (offset_ + length > size_) {
      Napi::Error::New(env_, "Reading sequence past the end of the buffer.").ThrowAsJavaScriptException();
      return NULL;
    }

    const uint8_t* str = data_ + offset_;
    offset_ += length;
    return (const char*) str;
  }

  Napi::Value decodeSmallInteger() {
    return Napi::Number::New(env_, read8());
  }

  Napi::Value decodeInteger() {
    return Napi::Number::New(env_, read32());
  }

  Napi::Value decodeFloat() {
    const uint8_t FLOAT_LENGTH = 31;
    const char* floatStr = readString(FLOAT_LENGTH);
    if (floatStr == NULL) {
      return env_.Undefined();
    }

    double number;
    char nullTerimated[FLOAT_LENGTH + 1] = {0};
    memcpy(nullTerimated, floatStr, FLOAT_LENGTH);

    auto count = sscanf(nullTerimated, "%lf", &number);
    if (count != 1) {
      Napi::Error::New(env_, "Invalid float.").ThrowAsJavaScriptException();
      return Napi::Value();
    }

    return Napi::Number::New(env_, number);
  }

  Napi::Value decodeNewFloat() {
    union {
      uint64_t ui64;
      double df;
    } val;
    val.ui64 = read64();
    return Napi::Number::New(env_, val.df);
  }

  Napi::Value decodeArray(uint32_t length) {
    Napi::Array array = Napi::Array::New(env_, length);
    for (uint32_t i = 0; i < length; ++i) {
      auto value = unpack();
      if (is_invalid_) {
        return env_.Undefined();
      }
      array.Set(i, value);
    }
    return array;
  }

  Napi::Value decodeList() {
    const uint32_t length = read32();
    auto array = decodeArray(length);

    const auto tailMarker = read8();
    if (tailMarker != NIL_EXT) {
      Napi::Error::New(env_, "List doesn't end with tail marker, but it must!").ThrowAsJavaScriptException();
      return Napi::Value();
    }

    return array;
  }

  Napi::Value decodeMap() {
    const uint32_t length = read32();
    Napi::Object map = Napi::Object::New(env_);

    for (uint32_t i = 0; i < length; i += 1) {
      Napi::Value key = unpack();
      Napi::Value value = unpack();
      if (is_invalid_) {
        return env_.Undefined();
      }
      map.Set(key, value);
    }

    return map;
  }

  Napi::Value decodeTuple(uint32_t length) {
    return decodeArray(length);
  }

  Napi::Value decodeStringAsList() {
    const auto length = read16();
    if (offset_ + length > size_) {
      Napi::Error::New(env_, "Reading sequence past the end of the buffer.").ThrowAsJavaScriptException();
      return Napi::Value();
    }

    Napi::Array array = Napi::Array::New(env_, length);
    for (uint16_t i = 0; i < length; i += 1) {
      array.Set(i, decodeSmallInteger());
    }

    return array;
  }

  Napi::Value decodeSmallTuple() {
    return decodeTuple(read8());
  }

  Napi::Value decodeLargeTuple() {
    return decodeTuple(read32());
  }

  Napi::Value decodeNil() {
    return Napi::Array::New(env_, 0);
  }

  Napi::Value processAtom(const char* atom, uint16_t length) {
    if (atom == NULL) {
      return env_.Undefined();
    }

    if (length == 3 && strncmp(atom, "nil", 3) == 0) {
      return env_.Null();
    }

    if (length == 4 && strncmp(atom, "null", 4) == 0) {
      return env_.Null();
    }

    if (length == 4 && strncmp(atom, "true", 4) == 0) {
      return Napi::Boolean::New(env_, true);
    }

    if (length == 5 && strncmp(atom, "false", 5) == 0) {
      return Napi::Boolean::New(env_, false);
    }

    return Napi::String::New(env_, atom);
  }

  Napi::Value decodeAtom() {
    auto length = read16();
    const char* atom = readString(length);
    return processAtom(atom, length);
  }

  Napi::Value decodeSmallAtom() {
    auto length = read8();
    const char* atom = readString(length);
    return processAtom(atom, length);
  }

  Napi::Value decodeBig(uint32_t digits) {
    const uint8_t sign = read8();

    if (digits > 8) {
      Napi::Error::New(env_, "Unable to decode big ints larger than 8 bytes").ThrowAsJavaScriptException();
      return Napi::Value();
    }

    uint64_t value = 0;
    uint64_t b = 1;

    for (uint32_t i = 0; i < digits; ++i) {
      uint64_t digit = read8();
      value += digit * b;
      b <<= 8;
    }

    // TODO(devsnek): kill this when napi supports bigint
    v8::Local<v8::BigInt> local = v8::BigInt::New(
        v8::Isolate::GetCurrent(), sign == 0 ? value : -value);
    return Napi::Value(env_, reinterpret_cast<napi_value>(*local));
  }

  Napi::Value decodeSmallBig() {
    const auto bytes = read8();
    return decodeBig(bytes);
  }

  Napi::Value decodeLargeBig() {
    const auto bytes = read32();
    return decodeBig(bytes);
  }

  Napi::Value decodeBinaryAsString() {
    const auto length = read32();
    const char* str = readString(length);
    if (str == NULL) {
      return env_.Undefined();
    }
    return Napi::String::New(env_, str, length);
  }

  Napi::Value decodePort() {
    Napi::Object o = Napi::Object::New(env_);
    o["node"] = unpack();
    o["id"] = Napi::Number::New(env_, read32());
    o["creation"] = Napi::Number::New(env_, read8());
    return o;
  }

  Napi::Value decodeExport() {
    Napi::Object o = Napi::Object::New(env_);
    o["mod"] = unpack();
    o["fun"] = unpack();
    o["arity"] = unpack();
    return o;
  }

  Napi::Value decodeReference() {
    Napi::Object o = Napi::Object::New(env_);
    o["node"] = unpack();
    Napi::Array ids = Napi::Array::New(env_, 1);
    ids[(uint32_t) 0] = Napi::Number::New(env_, read32());
    o["id"] = ids;
    o["creation"] = Napi::Number::New(env_, read8());
    return o;
  }

  Napi::Value decodeNewReference() {
    Napi::Object o = Napi::Object::New(env_);
    uint16_t len = read16();
    o["node"] = unpack();
    o["creation"] = Napi::Number::New(env_, read8());
    Napi::Array ids = Napi::Array::New(env_, len);
    for (uint16_t i = 0; i < len; i += 1) {
      ids[i] = Napi::Number::New(env_, read32());
    }
    o["id"] = ids;
    return o;
  }

  Napi::Value decodePID() {
    Napi::Object o = Napi::Object::New(env_);
    o["node"] = unpack();
    o["id"] = Napi::Number::New(env_, read32());
    o["serial"] = Napi::Number::New(env_, read32());
    o["creation"] = Napi::Number::New(env_, read8());
    return o;
  }

  Napi::Value decodeCompressed() {
    const uint32_t uncompressed_size = read32();
    unsigned long source_size = uncompressed_size;

    uint8_t* out_buffer = (uint8_t*) malloc(uncompressed_size);
    const int ret = uncompress(
        out_buffer,
        &source_size,
        (const unsigned char*) (data_ + offset_),
        (uLong)(size_ - offset_));

    offset_ += source_size;
    if (ret != Z_OK) {
      free(out_buffer);
      Napi::Error::New(env_, "Failed to uncompresss compressed item").ThrowAsJavaScriptException();
      return Napi::Value();
    }

    Decoder children(env_, out_buffer, uncompressed_size, true);
    Napi::Value value = children.unpack();
    free(out_buffer);
    return value;
  }

  Napi::Value unpack() {
    if (is_invalid_) {
      return Napi::Value();
    }

    if (offset_ >= size_) {
      Napi::Error::New(env_, "Read past end of buffer").ThrowAsJavaScriptException();
    }

    const auto type = read8();
    switch (type) {
      case SMALL_INTEGER_EXT:
        return decodeSmallInteger();
      case INTEGER_EXT:
        return decodeInteger();
      case FLOAT_EXT:
        return decodeFloat();
      case NEW_FLOAT_EXT:
        return decodeNewFloat();
      case ATOM_EXT:
        return decodeAtom();
      case SMALL_ATOM_EXT:
        return decodeSmallAtom();
      case SMALL_TUPLE_EXT:
        return decodeSmallTuple();
      case LARGE_TUPLE_EXT:
        return decodeLargeTuple();
      case NIL_EXT:
        return decodeNil();
      case STRING_EXT:
        return decodeStringAsList();
      case LIST_EXT:
        return decodeList();
      case MAP_EXT:
        return decodeMap();
      case BINARY_EXT:
        return decodeBinaryAsString();
      case SMALL_BIG_EXT:
        return decodeSmallBig();
      case LARGE_BIG_EXT:
        return decodeLargeBig();
      case REFERENCE_EXT:
        return decodeReference();
      case NEW_REFERENCE_EXT:
        return decodeNewReference();
      case PORT_EXT:
        return decodePort();
      case PID_EXT:
        return decodePID();
      case EXPORT_EXT:
        return decodeExport();
      case COMPRESSED:
        return decodeCompressed();
      default:
        Napi::Error::New(env_, "Unsupported erlang term type found").ThrowAsJavaScriptException();
        return Napi::Value();
    }

    return Napi::Value();
  }

 private:
  Napi::Env env_;
  const uint8_t* const data_;
  const size_t size_;
  bool is_invalid_;
  size_t offset_;
};
