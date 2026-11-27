import assert from "node:assert/strict";
import { test } from "node:test";
import { isPhoneShareUrl } from "../src/lib/share-url";
import { viewerRoute } from "../scripts/viewer-gateway.mjs";

const eventId = "a".repeat(24);
import { createViewerGateway } from "../scripts/viewer-gateway.mjs";
import http from "node:http";

test("phone QR rejects localhost, LAN, HTTP and credentials in URLs", () => {
  for (const url of ["http://localhost:3000", "https://localhost", "https://0.0.0.0", "https://127.0.0.1", "https://192.168.1.2", "https://10.0.0.1", "https://172.16.0.1", "https://[::1]", "https://machine.local", "https://user:secret@example.com"]) assert.equal(isPhoneShareUrl(url), false, url);
  assert.equal(isPhoneShareUrl("https://captions.example.com/event/123"), true);
  assert.equal(isPhoneShareUrl("https://demo.trycloudflare.com/event/123"), true);
});
test("public gateway allows viewer pages, status, static assets and viewer Token only", () => {
  assert.equal(viewerRoute("GET", `/event/${eventId}`), "page");
  assert.equal(viewerRoute("GET", `/api/events/${eventId}`), "status");
  assert.equal(viewerRoute("HEAD", "/_next/static/chunks/app.js"), "asset");
  assert.equal(viewerRoute("POST", `/api/events/${eventId}/tokens`, { role: "viewer" }), "token");
  assert.equal(viewerRoute("POST", `/api/events/${eventId}/tokens`, {}), "token");
});
test("public gateway blocks all host operations, secrets and Token role overrides", () => {
  for (const [method, route] of [
    ["GET", "/"], ["POST", "/api/events"], ["POST", `/api/events/${eventId}/start`],
    ["POST", `/api/events/${eventId}/stop`], ["POST", `/api/events/${eventId}/agent`],
    ["GET", "/api/setup"], ["POST", "/api/cleanup"], ["GET", "/.env.local"],
    ["GET", "/_next/server/app/page.js"], ["GET", "/_next/static/chunks/app.js.map"],
  ]) assert.equal(viewerRoute(method, route, {}), null, route);
  for (const body of [{ role: "host" }, { role: "stt" }, { role: "viewer", uid: 123 }, { role: "viewer", channelName: "other" }, [], "viewer"]) assert.equal(viewerRoute("POST", `/api/events/${eventId}/tokens`, body), null);
});

 test("gateway forwards only canonical viewer tokens and blocks host operations over HTTP", async () => {
  const seen: { path: string; body: string; authorization: string | undefined }[] = [];
  const upstream = http.createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    seen.push({ path: req.url || "", body, authorization: req.headers.authorization });
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamPort = (upstream.address() as import("node:net").AddressInfo).port;
  const gateway = createViewerGateway({ upstream: `http://127.0.0.1:${upstreamPort}`, healthKey: "a".repeat(64), getPublicUrl: () => "https://captions.example.com" });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  const port = (gateway.address() as import("node:net").AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(`${base}/api/events/${eventId}`)).status, 200);
    assert.equal((await fetch(`${base}/api/events/${eventId}/tokens?role=host`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://captions.example.com", Authorization: `Bearer ${"b".repeat(64)}` }, body: JSON.stringify({ role: "viewer" }) })).status, 200);
    assert.equal(seen.at(-1)?.body, '{"role":"viewer"}');
    assert.equal(seen.at(-1)?.authorization, `Bearer ${"b".repeat(64)}`);
    assert.equal((await fetch(`${base}/api/events/${eventId}/tokens`, { method: "POST", body: '{"role":"host"}' })).status, 403);
    assert.equal((await fetch(`${base}/api/events/${eventId}/stop`, { method: "POST", body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/.env.local`)).status, 403);
    assert.equal((await fetch(`${base}/api/events/${eventId}/tokens`, { method: "POST", headers: { Origin: "https://foreign.invalid" }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/__health`)).status, 403);
    assert.equal((await fetch(`${base}/__health`, { headers: { Authorization: `Bearer ${"a".repeat(64)}` } })).status, 204);
    assert.equal(seen.length, 2);
  } finally { gateway.closeAllConnections(); upstream.closeAllConnections(); await Promise.all([new Promise<void>(r => gateway.close(() => r())), new Promise<void>(r => upstream.close(() => r()))]); }
 });
