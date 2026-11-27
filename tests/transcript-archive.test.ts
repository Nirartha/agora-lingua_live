import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ArchiveWriter, listArchives, readArchive, saveCaptions } from "../src/lib/transcript-archive";
import { elapsedTime, formatTranscript, transcriptFilename, type ArchiveInfo } from "../src/lib/transcript-export";
import type { Caption } from "../src/lib/transcripts";

const base = Date.UTC(2026, 10, 26, 1, 0, 0);
const info = (id: string, direction: "zh-en" | "en-zh" = "zh-en"): ArchiveInfo => ({ id, eventId: id, generation: 1, title: "會議 / 測試", direction, startedAt: base, firstCapturedAt: base, savedAt: base, count: 0 });
const row = (id: string, change: Partial<Caption> = {}): Caption => ({ id, speaker: "123", original: "今天天气如何？", translation: "How's the weather today?", originalLanguage: "zh-CN", language: "en-US", final: true, receivedAt: base + 65000, ...change });

test("persisted rows survive a new reader and duplicate updates replace without incrementing count", async () => {
  const archive = info("replace");
  await saveCaptions(archive, [row("1", { final: false, original: "今天" })]);
  await saveCaptions(archive, [row("1")]);
  await saveCaptions(archive, [row("1", { final: false, original: "stale" })]);
  const loaded = (await readArchive(archive.id))!;
  assert.equal(loaded.info.count, 1);
  assert.equal(loaded.captions[0].original, "今天天气如何？");
  assert.equal(loaded.captions[0].final, true);
  assert.ok((await listArchives()).some(value => value.id === archive.id));
});
test("one-hour and three-hour exports retain all text beyond 100 display rows", async () => {
  const archive = info("three-hours");
  // Synthetic 3h meeting, one caption every two seconds; never connect Agora.
  for (let start = 0; start < 5400; start += 100) {
    await saveCaptions(archive, Array.from({ length: 100 }, (_, index) => row(String(start + index), { original: `第 ${start + index + 1} 句。`, translation: `Sentence ${start + index + 1}.`, receivedAt: base + (start + index) * 2000 })));
  }
  const loaded = (await readArchive(archive.id))!;
  assert.equal(loaded.info.count, 5400); assert.equal(loaded.captions.length, 5400);
  const text = formatTranscript(loaded.info, loaded.captions, "bilingual");
  assert.ok(text.includes("第 1 句。")); assert.ok(text.includes("第 5400 句。"));
  assert.ok(text.includes("[01:00:00 | 10:00:00]"));
  assert.ok(text.includes("[02:59:58 | 11:59:58]"));
});
test("all TXT formats map languages correctly in both translation directions", () => {
  for (const direction of ["zh-en", "en-zh"] as const) {
    const chineseSource = direction === "zh-en";
    const caption = row("1", chineseSource ? {} : { original: "How's the weather today?", translation: "今天天气如何？", originalLanguage: "en-US", language: "zh-CN" });
    const metadata = info(`format-${direction}`, direction);
    const chinese = formatTranscript(metadata, [caption], "zh");
    const english = formatTranscript(metadata, [caption], "en");
    const bilingual = formatTranscript(metadata, [caption], "bilingual");
    assert.ok(chinese.includes("今天天氣如何？")); assert.ok(!chinese.includes("How's the weather today?"));
    assert.ok(english.includes("How's the weather today?")); assert.ok(!english.includes("今天天氣如何？"));
    assert.ok(bilingual.includes("中文：今天天氣如何？")); assert.ok(bilingual.includes("English: How's the weather today?"));
    assert.ok(bilingual.startsWith("\uFEFF")); assert.ok(bilingual.includes("[00:01:05 | 09:01:05]"));
  }
});
test("export marks interim or missing translation honestly, preserves time across revisions", async () => {
  const archive = info("partial");
  await saveCaptions(archive, [row("a", { final: false, translation: "", receivedAt: base + 1000 })]);
  await saveCaptions(archive, [row("a", { final: false, translation: "", receivedAt: base + 9000 })]);
  const loaded = (await readArchive(archive.id))!;
  assert.equal(loaded.captions[0].receivedAt, base + 1000);
  const text = formatTranscript(loaded.info, loaded.captions, "bilingual");
  assert.ok(text.includes("[未完成]")); assert.ok(text.includes("[English caption unavailable]"));
  assert.equal(elapsedTime(3 * 3600000), "03:00:00");
  assert.ok(!/[<>:"/\\|?*]/.test(transcriptFilename(archive, "zh")));
});
test("writer coalesces revisions, flushes more than 100 rows, and resumes a saved archive", async () => {
  const archive = info("writer");
  let count = 0;
  const writer = new ArchiveWriter(archive, value => { count = value.count; }, error => { throw error; });
  for (let index = 0; index < 250; index++) writer.capture([row(String(index))]);
  writer.capture([row("0", { original: "修正後原文。" })]);
  await writer.flush();
  assert.equal(count, 250);
  const resumed = new ArchiveWriter(archive, () => {}, error => { throw error; });
  resumed.capture([row("250")]); await resumed.flush();
  const loaded = (await readArchive(archive.id))!;
  assert.equal(loaded.info.count, 251);
  assert.equal(loaded.captions.find(value => value.id === "0")?.original, "修正後原文。");
});
test("failed storage keeps the newest pending revision for retry instead of overwriting it", async () => {
  let fail: (error: Error) => void = () => {};
  let attempts = 0, failures = 0;
  const writer = new ArchiveWriter(info("retry"), () => {}, () => { failures++; }, async (metadata, rows) => {
    if (++attempts === 1) await new Promise<void>((_resolve, reject) => { fail = reject; });
    return saveCaptions(metadata, rows);
  });
  writer.capture([row("1", { original: "辨識中", final: false })]);
  const first = writer.flush();
  writer.capture([row("1", { original: "最新修正。", final: true })]);
  fail(new Error("simulated quota failure"));
  await assert.rejects(first);
  assert.equal(failures, 1);
  await writer.flush();
  const loaded = (await readArchive("retry"))!;
  assert.equal(loaded.info.count, 1);
  assert.equal(loaded.captions[0].original, "最新修正。");
});
