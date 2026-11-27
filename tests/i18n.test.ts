import assert from "node:assert/strict";
import { test } from "node:test";
import { captionHint, localizedEventTitle, localizedUrl, translate } from "../src/lib/i18n";

test("saved built-in event titles follow UI language in both directions without rewriting custom names", () => {
  const saved = {title: "一場跨越語言的對話"};
  assert.equal(localizedEventTitle(saved.title, "en"), "A conversation across languages");
  assert.equal(localizedEventTitle(saved.title, "zh-TW"), "一場跨越語言的對話");
  assert.equal(saved.title, "一場跨越語言的對話");
  assert.equal(localizedEventTitle("A conversation across languages", "zh-TW"), "一場跨越語言的對話");
  for (const custom of ["客戶的年度活動", "一場跨越語言的對話 — 客戶場次", "已連線", "Customer event", ""]) {
    assert.equal(localizedEventTitle(custom, "en"), custom);
    assert.equal(localizedEventTitle(custom, "zh-TW"), custom);
  }
});

test("caption hints use pane language independently of the interface locale", () => {
  assert.equal(captionHint("en-US", "translating"), "Translating, please wait");
  assert.equal(captionHint("zh-CN", "translating"), "翻譯中，請稍候");
  assert.equal(captionHint("en-US", "recognizing"), "Recognizing…");
  assert.equal(captionHint("zh-TW", "waiting"), "等候下一句發言");
  assert.equal(captionHint("en-US", "updating"), "Translation updating");
});
test("UI messages localize counts, status and errors without changing arbitrary content", () => {
  assert.equal(translate("en", "{count} 段已保存", {count:137}), "137 segments saved");
  assert.equal(translate("en", "本次連線 · 第 {first}–{last} 段", {first:38,last:137}), "This connection · Segments 38–137");
  assert.equal(translate("zh-TW", "{count} 段已保存", {count:137}), "137 段已保存");
  assert.equal(translate("en", "已連線"), "Connected");
  assert.equal(translate("en", "找不到這場活動，請確認分享網址。"), "Event not found. Check the shared URL.");
  assert.equal(translate("en", "翻譯服務拒絕啟動（HTTP 403），請檢查 Project、REST 憑證與服務開通設定。"), "Translation start rejected (HTTP 403). Check the project, REST credentials and service activation.");
  assert.equal(translate("en", "客戶自己的活動標題"), "客戶自己的活動標題");
});
test("audience, display and subtitle links preserve UI locale and existing parameters", () => {
  assert.equal(localizedUrl("/event/abc?view=display", "en"), "/event/abc?view=display&lang=en");
  assert.equal(localizedUrl("https://example.com/event/abc?lang=en", "zh-TW"), "https://example.com/event/abc?lang=zh-TW");
  assert.equal(localizedUrl("", "en"), "");
});
