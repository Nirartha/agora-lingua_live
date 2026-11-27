import assert from "node:assert/strict";
import { test } from "node:test";
import { traditionalChinese } from "../src/lib/chinese";
import { TranscriptBuffer } from "../src/lib/transcripts";

test("Chinese display uses traditional characters; English and existing traditional text are preserved", () => {
  assert.equal(traditionalChinese("今天天气如何？"), "今天天氣如何？");
  assert.equal(traditionalChinese("你好吗？欢迎大家参加活动。"), "你好嗎？歡迎大家參加活動。");
  assert.equal(traditionalChinese("How's the weather today? Agora SDK 2026"), "How's the weather today? Agora SDK 2026");
  assert.equal(traditionalChinese("繁體中文測試"), "繁體中文測試");
});
test("both the Chinese original and the Chinese translation are converted", () => {
  const buffer = new TranscriptBuffer();
  buffer.accept("9001", JSON.stringify({ object: "user.transcription", stream_id: 123, turn_id: 1, text: "今天天气如何？", language: "zh-CN", final: true }));
  assert.equal(buffer.items()[0].original, "今天天氣如何？");
  buffer.accept("9001", JSON.stringify({ object: "user.translation", stream_id: 123, turn_id: 1, text: "How's the weather today?", transcript_text: "今天天气如何？", final: true }));
  assert.equal(buffer.items()[0].original, "今天天氣如何？");
  assert.equal(buffer.items()[0].translation, "How's the weather today?");
  buffer.accept("9001", JSON.stringify({ object: "user.translation", stream_id: 123, turn_id: 2, text: "欢迎参加今天的活动。", transcript_text: "Welcome to today's event.", final: true }));
  assert.equal(buffer.items()[1].translation, "歡迎參加今天的活動。");
  assert.equal(buffer.items()[1].original, "Welcome to today's event.");
});
