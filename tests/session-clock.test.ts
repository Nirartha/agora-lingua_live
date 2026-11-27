import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionElapsed } from "../src/lib/session-clock";
import type { PublicSession } from "../src/lib/contracts";

test("timer counts up across minutes and hours instead of resetting or counting down", () => {
  const session = {startedAt:100000,status:"RUNNING"} as PublicSession;
  assert.equal(sessionElapsed(null,100000),"00:00:00");
  assert.equal(sessionElapsed(session,160000),"00:01:00");
  assert.equal(sessionElapsed(session,100000+3*3600000+65000),"03:01:05");
  assert.equal(sessionElapsed({...session,status:"STOPPED",stoppedAt:160000},9999999),"00:01:00");
});
