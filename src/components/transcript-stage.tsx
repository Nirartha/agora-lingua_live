"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Subtitles } from "lucide-react";

/** Expand only the transcript, and mirror native fullscreen state (including Esc). */
export function TranscriptStage({ children, tools }: { children: React.ReactNode; tools?: React.ReactNode }) {
  const { t } = useLanguage();
  const panel = useRef<HTMLElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const sync = () => setNativeFullscreen(document.fullscreenElement === panel.current);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("fullscreenchange", sync); document.removeEventListener("keydown", escape); };
  }, []);
  const toggle = async () => {
    setNotice("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (expanded) setExpanded(false);
      else if (panel.current?.requestFullscreen && document.fullscreenEnabled) await panel.current.requestFullscreen();
      else setExpanded(true); // iPhone/in-app browsers may not support native fullscreen.
    } catch {
      if (document.fullscreenElement) setNotice("請按 Esc 離開全螢幕。");
      else setExpanded(true);
    }
  };
  const maximized = nativeFullscreen || expanded;
  return <section ref={panel} className={`transcript-stage ${expanded ? "transcript-expanded" : ""}`}>
    <div className="stage-toolbar"><div className="stage-tabs"><span className="stage-tab active"><Subtitles size={14}/>{t("即時字幕")}</span><span className="stage-secondary">TRANSCRIPT & TRANSLATION</span></div><div className="stage-actions">{tools}<button className="tool-button" aria-label={maximized ? t("退出全螢幕") : t("放大字幕視窗")} title={maximized ? t("退出全螢幕（Esc）") : t("放大字幕視窗")} aria-pressed={maximized} onClick={() => void toggle()}>{maximized ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></div></div>
    {notice && <div className="fullscreen-notice" role="status">{t(notice)}</div>}
    {children}
  </section>;
}
