#include <node.h>
extern "C" {
    #include "x0/x0.h"
}

using v8::Exception;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

void Compile(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  if (args.Length() != 3) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments").ToLocalChecked()));
    return;
  }

  if (!args[0]->IsString() || !args[1]->IsString() || !args[2]->IsBoolean()) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong arguments").ToLocalChecked()));
    return;
  }

  // double value = args[0].As<Number>()->Value() + args[1].As<Number>()->Value();
  v8::String::Utf8Value source(isolate, args[0]);
  v8::String::Utf8Value output_path(isolate, args[1]);
  // printf("source: %s\n output_path: %s\n", *source, *output_path);

  int e = compile_and_run(*source, *output_path, args[2].As<v8::Boolean>()->Value());
  if (e) exit(1);

  Local<Number> num = Number::New(isolate, e);
  args.GetReturnValue().Set(num);
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "compile", Compile);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
