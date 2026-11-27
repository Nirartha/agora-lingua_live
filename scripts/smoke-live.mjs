// Creates one short-lived real Agent without opening a microphone. Always tries to stop it.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
let room;
async function request(path, body, host = false) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(host ? { Authorization: `Bearer ${room.hostKey}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${result.code || response.status}: ${result.error || "Request failed"}`);
  return result;
}
try {
  const setup = await request("/api/setup");
  if (!setup.ready) throw new Error(`Missing configuration: ${setup.missing.join(", ")}`);
  console.log("Configuration is present (values hidden).");
  room = await request("/api/events", { title: "服務連通驗證（無收音）", direction: "zh-en", accessCode: process.env.DEMO_ACCESS_CODE || "" });
  for (const role of ["host", "viewer"]) {
    const grant = await request(`/api/events/${room.session.id}/tokens`, { role }, role === "host");
    if (!grant.credentials?.token?.startsWith("007")) throw new Error("Invalid token response");
    console.log(`${role} Token: OK (value hidden).`);
  }
  const started = await request(`/api/events/${room.session.id}/start`, {}, true);
  console.log(`V2V join: ${started.session.status}.`);
  const queried = await request(`/api/events/${room.session.id}/agent`, {}, true);
  console.log(`V2V query: ${queried.remoteStatus}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (room) {
    try {
      const stopped = await request(`/api/events/${room.session.id}/stop`, {}, true);
      console.log(`V2V leave: ${stopped.session.status}.`);
    } catch (error) {
      console.error(`Cleanup needs attention for event ${room.session.id}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
