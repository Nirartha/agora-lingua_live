"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useRef, useState } from "react";
import { Download, FileText, HardDrive, LoaderCircle, X } from "lucide-react";
import { readArchive } from "@/lib/transcript-archive";
import { EXPORT_LABELS, formatTranscript, transcriptFilename, type ArchiveInfo, type TranscriptFormat } from "@/lib/transcript-export";
import { localizedEventTitle } from "@/lib/i18n";

export function TranscriptDownloads({ archives, currentId, flush, error, saving }: { archives: ArchiveInfo[]; currentId?: string; flush: () => Promise<void>; error: string; saving: boolean }) {
  const { locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [format, setFormat] = useState<TranscriptFormat>("bilingual");
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState("");
  const [downloadedCount, setDownloadedCount] = useState<number | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const selection = selected || (archives.some(info => info.id === currentId) ? currentId : archives[0]?.id) || "";
  const info = archives.find(info => info.id === selection);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const outside = (event: PointerEvent) => { if (!area.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", escape); document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  const download = async () => {
    if (!selection) return;
    setDownloading(true); setNotice(""); setDownloadedCount(null);
    try {
      await flush();
      const archive = await readArchive(selection);
      if (!archive?.captions.length) throw new Error("尚無已保存的字幕可下載。");
      const blob = new Blob([formatTranscript(archive.info, archive.captions, format)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = transcriptFilename(archive.info, format);
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloadedCount(archive.captions.length);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "暫時無法下載，請重試。"); }
    finally { setDownloading(false); }
  };
  return <div ref={area} className="archive-tools">
    <span className={`archive-indicator ${error ? "failed" : ""}`} title={t(error || "文字自動保存在本機瀏覽器")}><HardDrive size={12}/>{error ? t("保存需處理") : saving ? t("保存中") : t("{count} 段已保存", {count: archives.find(a => a.id === currentId)?.count ?? 0})}</span>
    <button className="tool-button" aria-label={t("下載字幕")} title={t("保存與下載字幕")} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void flush().catch(() => {}); }}><Download size={16}/></button>
    {open && <section className="archive-popover" aria-label={t("字幕下載設定")}><div className="archive-title"><span><FileText size={16}/>{t("保存與下載字幕")}</span><button className="tool-button" aria-label={t("關閉下載設定")} onClick={() => setOpen(false)}><X size={15}/></button></div>
      <p className="archive-local"><HardDrive size={13}/>{t("僅保存在這台瀏覽器，不含錄音。")}</p>
      <label>{t("選擇活動")}<select aria-label={t("選擇保存活動")} value={selection} onChange={event => {setSelected(event.target.value); setDownloadedCount(null); setNotice("");}}>{!archives.length && <option value="">{t("尚無保存字幕")}</option>}{archives.map(archive => <option key={archive.id} value={archive.id}>{t("{title} · {count} 段", {title: localizedEventTitle(archive.title, locale), count: archive.count})}</option>)}</select></label>
      <label>{t("下載格式")}<select aria-label={t("字幕下載格式")} value={format} onChange={event => {setFormat(event.target.value as TranscriptFormat); setDownloadedCount(null); setNotice("");}}>{Object.entries(EXPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{t(label)} TXT</option>)}</select></label>
      <p className="archive-detail">{info ? t("{count} 段文字已保存，最近保存 {time}", {count: info.count, time: new Date(info.savedAt).toLocaleTimeString(locale === "en" ? "en-US" : "zh-TW")}) : t("開始活動後，收到的字幕會自動保存。")}</p>
      <p className="archive-detail">{t("含活動經過時間與台北時間。時間依字幕首次接收近似；斷線或關頁期間無法補收。")}</p>
      {error && <p className="archive-error" role="alert">{t(error)}<button className="text-button" onClick={() => void flush().catch(() => {})}>{t("重試保存")}</button></p>}
      <button className="primary-button archive-download" disabled={!info?.count || downloading} onClick={() => void download()}>{downloading ? <LoaderCircle size={14} className="spinning"/> : <Download size={14}/>}{t("下載 {format} TXT", {format: t(EXPORT_LABELS[format])})}</button>
      {(notice || downloadedCount !== null) && <p className="archive-detail" role="status">{notice ? t(notice) : t("已產生 {count} 段{format} TXT。", {count: downloadedCount!, format: t(EXPORT_LABELS[format])})}</p>}
    </section>}
  </div>;
}
