import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSameOrigin, publicOrigin } from "../src/lib/server/http";
test("localhost browser matches inbound Host despite Next internal 0.0.0.0 URL", () => {
  assert.doesNotThrow(() => assertSameOrigin(new Request("http://0.0.0.0:3000/api/events", { headers: { host: "localhost:3000", origin: "http://localhost:3000" } })));
  assert.equal(publicOrigin(new Request("http://0.0.0.0:3000/api/events", { headers: { host: "localhost:3000" } })), "http://localhost:3000");
});
test("foreign Origin and different localhost ports remain rejected", () => {
  for (const origin of ["https://evil.invalid", "http://localhost:4000", "null"]) {
    assert.throws(() => assertSameOrigin(new Request("http://0.0.0.0:3000/api/events", { headers: { host: "localhost:3000", origin } })));
  }
});
test("HTTPS production origin works and forwarded-host cannot override Host", () => {
  assert.doesNotThrow(() => assertSameOrigin(new Request("https://demo.example.com/api/events", { headers: { host: "demo.example.com", origin: "https://demo.example.com" } })));
  assert.throws(() => assertSameOrigin(new Request("http://0.0.0.0:3000/api/events", { headers: { host: "localhost:3000", origin: "https://evil.invalid", "x-forwarded-host": "evil.invalid" } })));
});
