import assert from "node:assert/strict";
import { test } from "node:test";
import { captionScrollTarget } from "../src/lib/caption-position";

test("short captions remain centered in desktop and phone caption viewports", () => {
  for (const [viewport, rowHeight] of [[600, 80], [320, 150]]) {
    const rowTop = 900;
    const target = captionScrollTarget(rowTop, rowHeight, viewport);
    assert.equal(rowTop - target + rowHeight / 2, viewport / 2);
  }
});
test("a sentence taller than the screen keeps its latest tail at eye level", () => {
  const viewport = 400, rowHeight = 1200, rowTop = 900;
  const target = captionScrollTarget(rowTop, rowHeight, viewport);
  const bottom = rowTop + rowHeight - target;
  assert.ok(bottom >= viewport / 2 && bottom < viewport / 2 + 40);
});
test("a growing sentence and a new row both push old content upward", () => {
  assert.ok(captionScrollTarget(900, 1000, 400) > captionScrollTarget(900, 80, 400));
  assert.ok(captionScrollTarget(1100, 80, 400) > captionScrollTarget(900, 80, 400));
  assert.equal(captionScrollTarget(0, 80, 400), 0);
});
