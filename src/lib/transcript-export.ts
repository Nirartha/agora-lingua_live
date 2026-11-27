import type { Direction } from "./contracts";
import type { Caption } from "./transcripts";
import { traditionalChinese } from "./chinese";

export type TranscriptFormat = "zh" | "en" | "bilingual";
export const EXPORT_LABELS: Record<TranscriptFormat, string> = { zh: "繁體中文", en: "英文", bilingual: "中英雙語" };
export interface ArchiveInfo {
  id: string;
  eventId: string;
  generation: number;
  title: string;
  direction: Direction;
  startedAt: number;
  firstCapturedAt: number;
  savedAt: number;
  count: number;
}

export function elapsedTime(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(v => String(v).padStart(2, "0")).join(":");
}
function wallTime(value: number) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(value);
}
function line(value: string) { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim(); }

export function transcriptFilename(info: ArchiveInfo, format: TranscriptFormat) {
  const title = info.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().slice(0, 60) || "逐字稿";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(info.startedAt).replace(/[^\d-]/g, "");
  return `${title}_${day}_${info.eventId.slice(0, 8)}_${format}.txt`;
}

export function formatTranscript(info: ArchiveInfo, captions: Caption[], format: TranscriptFormat) {
  const sorted = [...captions].sort((a, b) => a.receivedAt - b.receivedAt || a.id.localeCompare(b.id, "en", { numeric: true }));
  const date = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "medium", hourCycle: "h23" });
  const lines = [
    `${line(info.title)} — ${EXPORT_LABELS[format]}逐字稿`,
    `活動：${info.eventId}／第 ${Math.max(1, info.generation)} 次連線`,
    `活動開始：${date.format(info.startedAt)}（Asia/Taipei）`,
    `收集開始：${date.format(info.firstCapturedAt)}（Asia/Taipei）`,
    `字幕段數：${sorted.length}`,
    "時間格式：[活動經過時間 | 台北時間]。發言時間以該段字幕首次接收時間近似，非音訊精確時間碼。",
    "僅包含主持人瀏覽器實際收到並保存的文字；斷線或關頁期間未收到的字幕無法補回。",
    "未完成、缺少譯文的片段會明確標記；中文採繁體字顯示轉換。",
    "",
  ];
  for (const caption of sorted) {
    const originalIsChinese = caption.originalLanguage ? /^zh(?:-|$)/i.test(caption.originalLanguage) : info.direction === "zh-en";
    const chinese = traditionalChinese(line(originalIsChinese ? caption.original : caption.translation));
    const english = line(originalIsChinese ? caption.translation : caption.original);
    lines.push(`[${elapsedTime(caption.receivedAt - info.startedAt)} | ${wallTime(caption.receivedAt)}] 發言者 ${line(caption.speaker)}${caption.final ? "" : " [未完成]"}`);
    if (format === "zh" || format === "bilingual") lines.push(`${format === "bilingual" ? "中文：" : ""}${chinese || "[尚無中文字幕]"}`);
    if (format === "en" || format === "bilingual") lines.push(`${format === "bilingual" ? "English: " : ""}${english || "[English caption unavailable]"}`);
    lines.push("");
  }
  // UTF-8 BOM improves compatibility with Windows text editors. CRLF is portable.
  return "\uFEFF" + lines.join("\n").replace(/\n/g, "\r\n");
}
