import assert from "node:assert/strict";
import { test } from "node:test";
import { SingleClient } from "../src/lib/single-client";

test("same-identity reconnect reuses one constructor and serializes logout before next login", async () => {
  const pool = new SingleClient<{ id: number }>(); const a = Symbol(), b = Symbol();
  let constructors = 0; const events: string[] = [];
  const create = () => ({ id: ++constructors });
  await pool.open(a, "app:123", create, async () => { events.push("login A"); }, async () => {});
  const close = pool.close(a, async () => { await new Promise((resolve) => setTimeout(resolve, 5)); events.push("logout A"); });
  const reopen = pool.open(b, "app:123", create, async () => { events.push("login B"); }, async () => {});
  await Promise.all([close, reopen]);
  assert.equal(constructors, 1);
  assert.deepEqual(events, ["login A", "logout A", "login B"]);
  await pool.close(a, async () => { assert.fail("stale owner must not log out B"); });
  await pool.close(b, async () => {});
});
test("failed login is cleaned and a retry reuses the registered identity", async () => {
  const pool = new SingleClient<object>(); let constructors = 0, cleanups = 0;
  const create = () => { constructors++; return {}; };
  await assert.rejects(pool.open(Symbol(), "123", create, async () => { throw new Error("failed login"); }, async () => { cleanups++; }));
  const owner = Symbol();
  await pool.open(owner, "123", create, async () => {}, async () => {});
  assert.equal(constructors, 1); assert.equal(cleanups, 1);
  await pool.close(owner, async () => {});
});
test("a different user requires a fresh page instead of a second SDK constructor", async () => {
  const pool = new SingleClient<object>(); const owner = Symbol(); let constructors = 0;
  const create = () => { constructors++; return {}; };
  await pool.open(owner, "123", create, async () => {}, async () => {});
  await pool.close(owner, async () => {});
  await assert.rejects(pool.open(Symbol(), "456", create, async () => {}, async () => {}), /重新整理/);
  assert.equal(constructors, 1);
});
