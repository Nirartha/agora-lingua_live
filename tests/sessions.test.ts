import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SessionService } from "../src/lib/server/sessions";
import { FileStore } from "../src/lib/server/store";
import { AgoraService } from "../src/lib/server/agora";
import { AppError } from "../src/lib/server/config";
import type { Session } from "../src/lib/contracts";

const settings = { appId: "1".repeat(32), apiBase: "https://api.agora.io", builderUrl: "https://example.invalid", customerId: "fake", customerSecret: "fake", preset: "v2vt_base" };
class TestAgora extends AgoraService {
  joins = 0; leaves = 0; joinFailure?: AppError; leaveFailure = false; remoteStatus = "RUNNING";
  constructor() { super(settings); }
  override async token(session: Session, uid: number) { return { appId: settings.appId, channel: session.channel, uid, token: "007fake-test-only", expiresAt: Date.now() + 3600000 }; }
  override async join() { this.joins++; if (this.joinFailure) throw this.joinFailure; return { agentId: "fake-agent", requestId: "fake-request" }; }
  override async leave() { this.leaves++; if (this.leaveFailure) throw new AppError(502, "STOP_FAILED", "test stop failed"); }
  override async query() { return { status: this.remoteStatus }; }
}
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "captions-test-"));
  const store = new FileStore(directory); const agora = new TestAgora(); const service = new SessionService(store, agora);
  const room = await service.create("測試活動", "zh-en");
  return { store, agora, service, room, close: () => rm(directory, { recursive: true, force: true }) };
}
test("repeated start creates one Agent; public state never exposes credentials", async () => {
  const f = await fixture();
  try {
    await f.service.start(f.room.session.id, f.room.hostKey);
    await f.service.start(f.room.session.id, f.room.hostKey);
    assert.equal(f.agora.joins, 1);
    const state = await f.service.get(f.room.session.id);
    assert.equal(state.status, "RUNNING"); assert.equal("hostKeyHash" in state, false); assert.equal("agentId" in state, false);
    await assert.rejects(f.service.start(f.room.session.id, "0".repeat(64)), (e: unknown) => e instanceof AppError && e.status === 403);
    await f.service.stop(f.room.session.id, f.room.hostKey);
    await f.service.stop(f.room.session.id, f.room.hostKey);
    assert.equal(f.agora.leaves, 1);
  } finally { await f.close(); }
});
test("viewers have distinct UIDs and can renew without changing identity", async () => {
  const f = await fixture();
  try {
    const a = await f.service.credentials(f.room.session.id, "", "viewer");
    const b = await f.service.credentials(f.room.session.id, "", "viewer");
    assert.notEqual(a.credentials.uid, b.credentials.uid);
    assert.notEqual(a.credentials.uid, f.room.session.hostUid);
    const renewed = await f.service.credentials(f.room.session.id, a.viewerKey!, "viewer");
    assert.equal(renewed.credentials.uid, a.credentials.uid);
    await assert.rejects(f.service.credentials(f.room.session.id, a.viewerKey!, "host"));
  } finally { await f.close(); }
});
test("reconnect checks whether the remote Agent was already reclaimed", async () => {
  const f = await fixture();
  try {
    await f.service.start(f.room.session.id, f.room.hostKey);
    f.agora.remoteStatus = "STOPPED";
    await assert.rejects(f.service.start(f.room.session.id, f.room.hostKey), (error: unknown) => error instanceof AppError && error.code === "AGENT_ENDED");
    assert.equal((await f.service.get(f.room.session.id)).status, "STOPPED");
    assert.equal(f.agora.joins, 1);
  } finally { await f.close(); }
});
test("join timeout is persisted and blocks a duplicate Agent", async () => {
  const f = await fixture();
  try {
    f.agora.joinFailure = new AppError(504, "JOIN_UNCERTAIN", "unknown");
    await assert.rejects(f.service.start(f.room.session.id, f.room.hostKey));
    assert.equal((await f.service.get(f.room.session.id)).status, "UNCERTAIN");
    await assert.rejects(f.service.start(f.room.session.id, f.room.hostKey));
    await assert.rejects(f.service.stop(f.room.session.id, f.room.hostKey));
    assert.equal(f.agora.joins, 1);
  } finally { await f.close(); }
});
test("failed stop retains Agent ID and can be retried", async () => {
  const f = await fixture();
  try {
    await f.service.start(f.room.session.id, f.room.hostKey); f.agora.leaveFailure = true;
    await assert.rejects(f.service.stop(f.room.session.id, f.room.hostKey));
    assert.equal((await f.service.get(f.room.session.id)).status, "STOPPING");
    assert.equal((await f.store.read()).sessions[f.room.session.id].agentId, "fake-agent");
    f.agora.leaveFailure = false;
    assert.equal((await f.service.stop(f.room.session.id, f.room.hostKey)).status, "STOPPED");
  } finally { await f.close(); }
});
test("checkpoint is durable before an external call and concurrent writes fail closed", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.store.transaction(async (state, checkpoint) => {
      state.sessions[f.room.session.id].status = "STARTING";
      await checkpoint();
      await assert.rejects(f.store.transaction(async () => 1), (error: unknown) => error instanceof AppError && error.code === "BUSY");
      throw new Error("simulated crash after journal");
    }));
    assert.equal((await f.store.read()).sessions[f.room.session.id].status, "STARTING");
  } finally { await f.close(); }
});
test("running activities have no app deadline, including old pilot rooms past two hours", async () => {
  const f = await fixture();
  try {
    const started = await f.service.start(f.room.session.id, f.room.hostKey);
    assert.equal(started.runUntil, null); assert.equal(started.expiresAt, null);
    await f.store.transaction(async state => {
      const old = state.sessions[f.room.session.id];
      old.startedAt = Date.now() - 3 * 3600000;
      old.runUntil = Date.now() - 2 * 3600000;
      old.expiresAt = Date.now() - 3600000;
    });
    assert.deepEqual(await f.service.cleanup(), []);
    assert.equal(f.agora.leaves, 0);
    const grant = await f.service.credentials(f.room.session.id, f.room.hostKey, "host");
    assert.equal(grant.credentials.uid, started.hostUid);
    const active = await f.service.get(f.room.session.id);
    assert.equal(active.status, "RUNNING"); assert.equal(active.expiresAt, null); assert.equal(active.runUntil, null);
    await f.service.stop(f.room.session.id, f.room.hostKey);
    assert.ok((await f.service.get(f.room.session.id)).stoppedAt);
  } finally { await f.close(); }
});
