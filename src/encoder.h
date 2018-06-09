#pragma once

#include <v8.h>
#include <napi.h>
#include <cmath>
#include <limits>
#include "../deps/erlpack/cpp/encoder.h"

class Encoder {
  static const size_t DEFAULT_RECURSE_LIMIT = 256;
  static const size_t INITIAL_BUFFER_SIZE = 1024 * 1024;

 public:
  Encoder(Napi::Env env, Napi::Function sts) {
    pk.buf = (char*) malloc(INITIAL_BUFFER_SIZE);

    pk.length = 0;
    pk.allocated_size = INITIAL_BUFFER_SIZE;

    symbol_to_string = Napi::Persistent(sts);

    int ret = erlpack_append_version(&pk);
    if (ret == -1) {
      Napi::Error::New(env, "Unable to allocate buffer for encoding.").ThrowAsJavaScriptException();
      return;
    }
  }

  ~Encoder() {
    if (pk.buf) {
      free(pk.buf);
    }
    pk.buf = NULL;
    pk.length = 0;
    pk.allocated_size = 0;
  }

  Napi::Value releaseAsBuffer(Napi::Env env) {
    if (pk.buf == NULL) {
      return Napi::Value();
    }

    auto buffer = Napi::Buffer<char>::New(env, pk.length);
    memcpy(buffer.Data(), pk.buf, pk.length);
    pk.length = 0;
    erlpack_append_version(&pk);
    return buffer;
  }

  int pack(Napi::Value value, const int nestLimit = DEFAULT_RECURSE_LIMIT) {
    Napi::Env env = value.Env();

    if (nestLimit < 0) {
      Napi::Error::New(env, "Reached recursion limit").ThrowAsJavaScriptException();
      return -1;
    }

    {
      // TODO(devsnek) kill this when napi supports bigints
      v8::Local<v8::Value> local;
      napi_value v = value; // must coerce to napi_value for copy op
      memcpy(&local, &v, sizeof(v));
      if (local->IsBigInt()) {
        std::string str = value.ToString().Utf8Value();
        size_t inx = 0;
        long long ll = std::stoll(str, &inx, 0);
        return erlpack_append_long_long(&pk, ll);
      }
    }

    if (value.IsNull() || value.IsUndefined()) {
      return erlpack_append_nil(&pk);
    }

    if (value.IsBoolean()) {
      if (value.As<Napi::Boolean>().Value()) {
        return erlpack_append_true(&pk);
      } else {
        return erlpack_append_false(&pk);
      }
    }

    if (value.IsNumber()) {
      return erlpack_append_double(&pk, value.As<Napi::Number>().DoubleValue());
    }

    if (value.IsString()) {
      std::string string = value.As<Napi::String>().Utf8Value();
      return erlpack_append_binary(&pk, string.c_str(), string.length());
    }

    if (value.IsSymbol()) {
      std::string string = symbol_to_string.Call({ value }).As<Napi::String>().Utf8Value();
      return erlpack_append_atom(&pk, string.c_str(), string.length());
    }

    if (value.IsArray()) {
      auto array = value.As<Napi::Array>();
      const uint32_t length = array.Length();
      if (length == 0) {
        return erlpack_append_nil_ext(&pk);
      }

      if (length > std::numeric_limits<uint32_t>::max() - 1) {
        Napi::Error::New(env, "Array is too long.").ThrowAsJavaScriptException();
        return -1;
      }

      int ret = erlpack_append_list_header(&pk, length);
      if (ret != 0) {
        return ret;
      }

      for (uint32_t i = 0; i < length; i += 1) {
        ret = pack(array[i], nestLimit - 1);
        if (ret != 0) {
          return ret;
        }
      }

      return erlpack_append_nil_ext(&pk);
    }

    if (value.IsTypedArray()) {
      auto array = value.As<Napi::TypedArray>();
      const uint32_t length = array.ElementLength();

      if (length == 0) {
        return erlpack_append_nil_ext(&pk);
      }

      if (length > std::numeric_limits<uint32_t>::max() - 1) {
        Napi::Error::New(env, "Array is too long.").ThrowAsJavaScriptException();
        return -1;
      }

      int ret = erlpack_append_list_header(&pk, length);
      if (ret != 0) {
        return ret;
      }

      for (uint32_t i = 0; i < length; i += 1) {
        ret = pack(array[i], nestLimit - 1);
        if (ret != 0) {
          return ret;
        }
      }

      return erlpack_append_nil_ext(&pk);
    }

    if (value.IsObject()) {
      Napi::Object object = value.As<Napi::Object>();
      Napi::Array properties = object.GetPropertyNames();
      const uint32_t len = properties.Length();

      if (len > std::numeric_limits<uint32_t>::max() - 1) {
        Napi::Error::New(env, "Dictionary has too many properties").ThrowAsJavaScriptException();
        return -1;
      }

      int ret = erlpack_append_map_header(&pk, len);
      if (ret != 0) {
        return ret;
      }

      for (uint32_t i = 0; i < len; i += 1) {
        Napi::Value key = properties[i];
        if (!object.HasOwnProperty(key)) {
          continue;
        }

        Napi::Value val = object.Get(key);

        ret = pack(key, nestLimit - 1);
        if (ret != 0) {
          return ret;
        }

        ret = pack(val, nestLimit - 1);
        if (ret != 0) {
          return ret;
        }
      }
    }

    return -1;
  }

 private:
  Napi::FunctionReference symbol_to_string;
  erlpack_buffer pk;
};
