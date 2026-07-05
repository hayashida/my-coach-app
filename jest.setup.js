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

// jsdom test environment (unlike node) does not expose the Fetch API globals.
// next/server's NextRequest/NextResponse classes do `extends Request` /
// `extends Response` at module-evaluation time, so importing a route handler
// module (e.g. `@/app/api/chat/route`) from a jsdom test fails with
// "ReferenceError: Request is not defined" unless these globals exist.
// These are intentionally minimal (not full spec) polyfills — just enough to
// satisfy next/server's class declarations and basic body/status/headers
// access used by integration tests that call real route handlers directly.
if (typeof global.Headers === "undefined") {
  global.Headers = class Headers extends Map {
    constructor(init) {
      super(
        init instanceof Map
          ? init
          : init
          ? Object.entries(init)
          : undefined
      );
    }
    get(name) {
      const value = super.get(name);
      return value === undefined ? null : value;
    }
  };
}

if (typeof global.Request === "undefined") {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = typeof input === "string" ? input : input.url;
      this.method = init.method ?? "GET";
      this.headers = new global.Headers(init.headers);
      this._bodyInit = init.body;
    }
    async json() {
      return typeof this._bodyInit === "string"
        ? JSON.parse(this._bodyInit)
        : this._bodyInit;
    }
    async text() {
      return typeof this._bodyInit === "string"
        ? this._bodyInit
        : String(this._bodyInit ?? "");
    }
  };
}

if (typeof global.Response === "undefined") {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.status = init.status ?? 200;
      this.statusText = init.statusText ?? "";
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new global.Headers(init.headers);
      this.body = body ?? null;
      this._bodyInit = body;
    }
    async json() {
      return typeof this._bodyInit === "string"
        ? JSON.parse(this._bodyInit)
        : this._bodyInit;
    }
    async text() {
      return typeof this._bodyInit === "string"
        ? this._bodyInit
        : String(this._bodyInit ?? "");
    }
    static json(data, init = {}) {
      return new global.Response(JSON.stringify(data), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
    }
  };
}
