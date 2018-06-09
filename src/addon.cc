#include <napi.h>
#include "encoder.h"
#include "decoder.h"

Napi::Value Pack(const Napi::CallbackInfo& args) {
  Napi::Env env = args.Env();
  Encoder encoder(env, args[1].As<Napi::Function>());

  const int ret = encoder.pack(args[0]);

  if (ret != 0 && !env.IsExceptionPending()) {
    Napi::Error::New(env, "Unknown error").ThrowAsJavaScriptException();
    return Napi::Value();
  } else if (env.IsExceptionPending()) {
    return Napi::Value();
  }

  return encoder.releaseAsBuffer(env);
}

Napi::Value Unpack(const Napi::CallbackInfo& args) {
  Napi::Env env = args.Env();

  Napi::Uint8Array contents = args[0].As<Napi::Uint8Array>();

  if (contents.ByteLength() == 0) {
    Napi::Error::New(env, "Zero length buffer.").ThrowAsJavaScriptException();
    return Napi::Value();
  }

  Decoder decoder(contents);
  return decoder.unpack();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports["pack"] = Napi::Function::New(env, Pack);
  exports["unpack"] = Napi::Function::New(env, Unpack);

  return exports;
}

NODE_API_MODULE(earl, Init)
