import assert from "node:assert/strict";
import { test } from "node:test";
import { mobileCaptionWindow } from "../src/lib/mobile-caption-pair";
import type { Caption } from "../src/lib/transcripts";

const caption = (id: string, final: boolean): Caption => ({ id, speaker: "1", original: id, translation: `en-${id}`, originalLanguage: "zh-CN", language: "en-US", final, receivedAt: 0 });

test("mobile keeps the latest five completed pairs and appends the current interim pair", () => {
  const items = Array.from({ length: 7 }, (_, index) => caption(String(index + 1), true));
  items.push(caption("pending", false));
  const result = mobileCaptionWindow(items);
  assert.deepEqual(result.completed.map((item) => item.id), ["3", "4", "5", "6", "7"]);
  assert.equal(result.pending?.id, "pending");
});

test("empty and first interim windows contain no invented completed captions", () => {
  assert.deepEqual(mobileCaptionWindow([]), {completed:[],pending:undefined});
  assert.equal(mobileCaptionWindow([caption("first",false)]).pending?.id,"first");
  assert.equal(mobileCaptionWindow([caption("first",false)]).completed.length,0);
});
