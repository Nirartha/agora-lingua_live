"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useRef, useState } from "react";
import { Globe2, Languages, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { Brand, Footer } from "./brand";
import { Captions } from "./captions";
import { api, type EventResult, type Grant } from "@/lib/client";
import { BrowserSession } from "@/lib/browser-session";
import { DIRECTIONS, STATUS_LABELS, type PublicSession } from "@/lib/contracts";
import type { Caption } from "@/lib/transcripts";
import { useViewerReadingMode } from "@/lib/use-viewer-reading-mode";
import { useViewerViewport } from "@/lib/use-viewer-viewport";
import { ViewerLayoutInfo } from "./viewer-layout-info";
import { VIEWER_REVISION } from "@/lib/viewer-frame";
import { localizedEventTitle } from "@/lib/i18n";

export function Viewer({ eventId, mode = "standard" }: { eventId: string; mode?: "standard" | "display" | "subtitle" }) {
  const { locale, t } = useLanguage();
  const viewportRoot = useViewerViewport();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("正在連接活動");
  const [retry, setRetry] = useState(0);
  const { flow, toggleFlow } = useViewerReadingMode();
  const transportRef = useRef<BrowserSession | null>(null);

  useEffect(() => {
    let alive = true;
    let transport: BrowserSession | null = null;
    const controller = new AbortController();
    const viewerKey = `lingua-viewer-${eventId}`;
    setError(""); setCaptions([]); setConnection("正在連接活動");
    const grant = async () => {
      const response = await api<Grant>(`/api/events/${eventId}/tokens`, { method: "POST", body: { role: "viewer" }, key: sessionStorage.getItem(viewerKey) || "", signal: controller.signal });
      if (response.viewerKey) sessionStorage.setItem(viewerKey, response.viewerKey);
      return response.credentials;
    };
    const connect = async () => {
      try {
        const data = await api<EventResult>(`/api/events/${eventId}`, { signal: controller.signal });
        if (!alive) return;
        setSession(data.session);
        if (data.session.status === "STOPPED" || (data.session.expiresAt !== null && data.session.expiresAt < Date.now())) { setConnection("活動已結束"); return; }
        const credentials = await grant();
        if (!alive) return;
        transport = new BrowserSession({
          session: data.session, credentials, host: false, renew: grant,
          onCaptions: (items) => { if (alive) setCaptions(items); },
          onConnection: (value) => { if (alive) setConnection(value); },
          onError: (message) => { if (alive) setError(message); },
        });
        transportRef.current = transport;
        await transport.connect();
        if (!alive) await transport.close();
      } catch (reason) {
        if (alive) { setConnection("連線未完成"); setError(reason instanceof Error ? reason.message : "無法加入活動。"); }
      }
    };
    void connect();
    const poll = setInterval(async () => {
      try {
        const data = await api<EventResult>(`/api/events/${eventId}`, { signal: controller.signal });
        if (!alive) return;
        setSession(data.session);
        if (data.session.status === "STOPPED" || (data.session.expiresAt !== null && data.session.expiresAt < Date.now())) {
          await transport?.close(); setConnection("活動已結束"); clearInterval(poll);
        }
      } catch { /* Keep current captions during temporary status request failures. */ }
    }, 5000);
    return () => { alive = false; controller.abort(); clearInterval(poll); void transport?.close(); transportRef.current = null; };
  }, [eventId, retry]);

  const ended = session?.status === "STOPPED" || !!session && (session.expiresAt !== null && session.expiresAt < Date.now());
  return <div ref={viewportRoot} data-viewer-revision={VIEWER_REVISION} className={`app-shell viewer-shell ${mode}-view ${flow ? "viewer-flow" : ""}`}><Brand viewer channel={session?.channel}/><main className="viewer-main"><section className="viewer-heading"><span className="intro-tag"><span/>LIVE CAPTIONS</span><div><h1>{session?.title ? localizedEventTitle(session.title, locale) : t("正在加入這場對話。")}</h1><span className={`connection-pill ${session?.status === "RUNNING" && !ended ? "online" : ""}`}><i/>{ended ? t("活動已結束") : session ? t(STATUS_LABELS[session.status]) : t("連接中")}</span></div><p>{t("原文與翻譯 · 即時同步")}</p><div className="viewer-info"><span><Languages size={15}/>{session ? t(DIRECTIONS[session.direction].label) : t("中文 ↔ English")}</span><span><Globe2 size={15}/>{t(connection)}</span><span><ShieldCheck size={15}/>{t("純字幕，不開啟麥克風")}</span></div></section>
    {error && <div className="notice error" role="alert"><span>{t(error)}</span><button className="text-button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={14}/>{t("重新連線")}</button></div>}
    {!session && !error ? <div className="loading-panel"><LoaderCircle size={24} className="spinning"/>{t("正在尋找你的活動…")}</div> : session && <><Captions items={captions} direction={session.direction} active={session.status === "RUNNING" && !ended && connection === "已連線"} viewer ended={ended} readingTools={<button aria-pressed={flow} title={t("旋轉後若被裁切，可切換為可捲動的閱讀版面")} onClick={toggleFlow}>{t(flow ? "切換固定閱讀" : "切換捲動閱讀")}</button>}/><div className="viewer-footnote"><span>{ended ? t("這場對話已告一段落，謝謝你的參與。") : t("加入後的字幕會即時出現，這個頁面不保存過往字幕。")}</span><div className="viewer-footer-actions"><ViewerLayoutInfo root={viewportRoot}/>{!ended && <button className="text-button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={13}/>{t("重新連線")}</button>}</div></div></>}
  </main><Footer/></div>;
}
