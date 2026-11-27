"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Caption } from "./transcripts";
import type { PublicSession } from "./contracts";
import { ArchiveWriter, archiveId, archiveInfo, listArchives } from "./transcript-archive";
import type { ArchiveInfo } from "./transcript-export";

export function useHostArchive() {
  const writers = useRef(new Map<string, ArchiveWriter>());
  const [archives, setArchives] = useState<ArchiveInfo[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => {
    try { setArchives(await listArchives()); } catch { setError("無法開啟本機文字資料庫，請確認不是限制儲存的瀏覽模式。"); }
  }, []);
  const flush = useCallback(async () => {
    setSaving(true);
    try { await Promise.all([...writers.current.values()].map(writer => writer.flush())); setError(""); await refresh(); }
    finally { setSaving(false); }
  }, [refresh]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void flush().catch(() => {}); }, 3000);
    const hide = () => { if (document.visibilityState === "hidden") void flush().catch(() => {}); };
    const leave = () => { void flush().catch(() => {}); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave); void Promise.all([...writers.current.values()].map(writer => writer.flush())).catch(() => {}); };
  }, [refresh, flush]);
  const capture = useCallback((session: PublicSession, captions: Caption[]) => {
    const id = archiveId(session);
    let writer = writers.current.get(id);
    if (!writer) {
      writer = new ArchiveWriter(archiveInfo(session), (info) => {
        setArchives(previous => [info, ...previous.filter(item => item.id !== info.id)].sort((a, b) => b.savedAt - a.savedAt));
        setError("");
      }, () => setError("文字尚未保存成功，可能是儲存空間不足。請保留此頁面並按重試保存。"));
      writers.current.set(id, writer);
    }
    if (session.startedAt) writer.info.startedAt = session.startedAt;
    writer.capture(captions);
  }, []);
  return { archives, error, saving, capture, flush, refresh };
}
