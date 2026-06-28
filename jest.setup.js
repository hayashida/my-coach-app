// Polyfill Web Streams API and Encoding API for jsdom environment
const { ReadableStream, WritableStream, TransformStream } = require("stream/web");
const { TextEncoder, TextDecoder } = require("util");

if (typeof global.ReadableStream === "undefined") {
  global.ReadableStream = ReadableStream;
}
if (typeof global.WritableStream === "undefined") {
  global.WritableStream = WritableStream;
}
if (typeof global.TransformStream === "undefined") {
  global.TransformStream = TransformStream;
}
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}
