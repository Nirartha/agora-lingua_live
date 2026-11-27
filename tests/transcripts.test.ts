import assert from "node:assert/strict";
import { test } from "node:test";
import { TranscriptBuffer } from "../src/lib/transcripts";

const message = (object = "user.translation", rest = {}) => ({ object, stream_id: 123, turn_id: 1, text: "Hello, everyone.", transcript_text: "大家好。", language: "en-US", transcript_language: "zh-CN", final: true, ...rest });
const frames = (value: unknown, id: string, count = 1) => {
  const encoded = Buffer.from(JSON.stringify(value), "utf8").toString("base64");
  const size = Math.ceil(encoded.length / count);
  return Array.from({ length: count }, (_, index) => `${id}|${index + 1}|${count}|${encoded.slice(index * size, (index + 1) * size)}`);
};
test("UTF-8 Chinese and emoji survive shuffled fragments and duplicate delivery", () => {
  const buffer = new TranscriptBuffer(); const [one, two, three] = frames(message(), "m1", 3);
  assert.equal(buffer.accept("9001", three), null);
  assert.equal(buffer.accept("9001", three), null);
  assert.equal(buffer.accept("9001", one), null);
  const items = buffer.accept("9001", two)!;
  assert.equal(items.length, 1); assert.equal(items[0].original, "大家好。");
  assert.equal(items[0].translation, "Hello, everyone."); assert.equal(items[0].final, true);
  assert.equal(buffer.accept("9001", two), null); assert.equal(buffer.items().length, 1);
});
test("ASR final is not translation final and metadata difference does not split a caption", () => {
  const buffer = new TranscriptBuffer();
  const original = message("user.transcription", { text: "大家好，", transcript_text: undefined });
  assert.equal(buffer.accept("9001", frames(original, "a")[0])![0].final, false);
  const translated = message("user.translation", { text: "Hello.", metadata: { session_id: "123" } });
  const items = buffer.accept("9001", frames(translated, "b")[0])!;
  assert.equal(items.length, 1); assert.equal(items[0].final, true);
});
test("late joining viewer can display translation without an earlier transcription", () => {
  const buffer = new TranscriptBuffer();
  buffer.accept("9001", frames(message(), "a")[0]);
  const items = buffer.accept("9001", frames(message("user.transcription", { text: "stale" }), "b")[0])!;
  assert.equal(items[0].original, "大家好。"); assert.equal(items[0].final, true);
});
test("turn fragments stay in one row until sentence-ending punctuation", () => {
  const buffer = new TranscriptBuffer();
  const parts = [
    ["我想", "I want"],
    ["取消我的", "to cancel my"],
    ["暑假。", "summer vacation."],
  ];
  parts.forEach(([original, translation], index) => {
    const items = buffer.accept("9001", frames(message("user.translation", { turn_id: index + 1, text: translation, transcript_text: original, final: true }), `sentence-${index}`)[0]);
    assert.ok(items);
    assert.equal(items!.length, 1);
  });
  assert.equal(buffer.items()[0].original, "我想取消我的暑假。");
  assert.equal(buffer.items()[0].translation, "I want to cancel my summer vacation.");
  assert.equal(buffer.items()[0].final, true);
});
test("ASR corrections and final transcript replace the same turn without duplicating Chinese", () => {
  const buffer = new TranscriptBuffer();
  const revisions = ["哈囉", "哈囉大家好，我是", "哈囉，大家好，我是K", "哈囉，大家好，我是Kerry。"];
  revisions.forEach((text, index) => {
    buffer.accept("9001", frames(message("user.transcription", { text, final: index === revisions.length - 1, transcript_text: undefined }), `asr-${index}`)[0]);
    assert.equal(buffer.items()[0].original, text);
    assert.equal(buffer.items()[0].final, false);
  });
  const result = buffer.accept("9001", frames(message("user.translation", { text: "Hello everyone, I'm Kerry.", transcript_text: "哈囉，大家好，我是Kerry。" }), "translated")[0])!;
  assert.equal(result.length, 1);
  assert.equal(result[0].original, "哈囉，大家好，我是Kerry。");
  assert.equal(result[0].translation, "Hello everyone, I'm Kerry.");
  assert.equal(result[0].final, true);
  // An older React state snapshot must not be mutated by a later event.
  assert.equal(buffer.accept("9001", frames(message("user.transcription", { text: "舊的辨識結果", final: false }), "stale-asr")[0])![0].original, result[0].original);
});
test("shorter rewritten ASR is a replacement rather than a suffix to append", () => {
  const buffer = new TranscriptBuffer();
  buffer.accept("9001", JSON.stringify(message("user.transcription", { text: "不是因為第三次世界大戰，也不也不是", final: false })));
  const snapshot = buffer.items()[0];
  buffer.accept("9001", JSON.stringify(message("user.transcription", { text: "不是因為第三次世界大戰，也不是因為金融危機，而是因為AI。", final: true })));
  assert.equal(buffer.items()[0].original, "不是因為第三次世界大戰，也不是因為金融危機，而是因為AI。");
  assert.equal(snapshot.original, "不是因為第三次世界大戰，也不也不是");
  buffer.accept("9001", JSON.stringify(message("user.translation", { text: "It is because of AI.", transcript_text: "不是因為戰爭，而是因為AI。", final: true })));
  assert.equal(buffer.items()[0].original, "不是因為戰爭，而是因為AI。");
});
test("multi-turn sentence updates each part in place, preserving genuine repeated speech", () => {
  const buffer = new TranscriptBuffer();
  const send = (turn: number, object: string, rest: object) => buffer.accept("9001", JSON.stringify(message(object, { turn_id: turn, ...rest })));
  send(1, "user.translation", { text: "Sorry,", transcript_text: "不好意思，", final: true });
  send(2, "user.transcription", { text: "我要取消我", final: false });
  send(2, "user.transcription", { text: "我要取消我的暑假。", final: true });
  send(2, "user.translation", { text: "I'm cancelling my vacation.", transcript_text: "我要取消我的暑假。", final: true });
  assert.equal(buffer.items().length, 1);
  assert.equal(buffer.items()[0].original, "不好意思，我要取消我的暑假。");
  assert.equal(buffer.items()[0].translation, "Sorry, I'm cancelling my vacation.");
  send(3, "user.translation", { text: "Thank you,", transcript_text: "謝謝，", final: true });
  send(4, "user.translation", { text: "thank you!", transcript_text: "謝謝！", final: true });
  assert.equal(buffer.items()[1].original, "謝謝，謝謝！");
  assert.equal(buffer.items()[1].translation, "Thank you, thank you!");
});
test("late final correction does not detach a newer active sentence", () => {
  const buffer = new TranscriptBuffer();
  const send = (turn: number, source: string) => buffer.accept("9001", JSON.stringify(message("user.translation", { turn_id: turn, text: source, transcript_text: source })));
  send(1, "第一句。");
  send(2, "第二句，");
  send(1, "修正第一句。");
  send(3, "還沒講完。");
  assert.equal(buffer.items().length, 2);
  assert.equal(buffer.items()[0].original, "修正第一句。");
  assert.equal(buffer.items()[1].original, "第二句，還沒講完。");
});
test("ASR sentence punctuation never seals the row before its translation arrives", () => {
  const buffer = new TranscriptBuffer();
  buffer.accept("9001", JSON.stringify(message("user.transcription", { text: "你好。", final: true })));
  assert.equal(buffer.items()[0].final, false);
  buffer.accept("9001", JSON.stringify(message("user.translation", { text: "Hello.", transcript_text: "你好。", final: true })));
  assert.equal(buffer.items()[0].final, true);
});
test("malformed indices and invalid UTF-8 do not crash or create captions", () => {
  const buffer = new TranscriptBuffer();
  for (const frame of ["a|0|1|e30=", "a|2|1|e30=", "a|1|999|e30=", "a|1|1|/w==", "broken", "a|1|1|%%%"]) assert.equal(buffer.accept("9001", frame), null);
  assert.equal(buffer.items().length, 0); assert.equal(buffer.stats().invalid, 6);
});
test("stale incomplete fragments expire and caption count is bounded", () => {
  let now = 0; const buffer = new TranscriptBuffer(() => now);
  buffer.accept("9001", frames(message(), "partial", 2)[0]); now = 16000;
  for (let i = 0; i < 105; i++) buffer.accept("9001", frames(message("user.translation", { turn_id: i }), `m${i}`)[0]);
  assert.equal(buffer.stats().incomplete, 1); assert.equal(buffer.items().length, 100);
  assert.equal(buffer.items()[0].sequence, 6);
  assert.equal(buffer.items().at(-1)!.sequence, 105);
  buffer.accept("9001", frames(message("user.translation", {turn_id:104,text:"A correction."}),"correction")[0]);
  assert.equal(buffer.items().at(-1)!.sequence,105);
  buffer.accept("9001", frames(message("user.translation", {turn_id:105}),"next")[0]);
  assert.equal(buffer.items().at(-1)!.sequence,106);
  buffer.reset(); assert.equal(buffer.items().length, 0);
});
