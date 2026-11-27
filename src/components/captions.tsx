"use client";
import { useLanguage } from "./language-provider";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, AudioLines, Languages } from "lucide-react";
import { DIRECTIONS, type Direction } from "@/lib/contracts";
import type { Caption } from "@/lib/transcripts";
import { traditionalChinese } from "@/lib/chinese";
import { captionScrollTarget } from "@/lib/caption-position";
import { captionHint } from "@/lib/i18n";
import { mobileCaptionWindow } from "@/lib/mobile-caption-pair";
import { MobileLiveBilingual } from "./mobile-live-bilingual";

export function Captions({ items, direction, active, viewer = false, ended = false, readingTools }: { items: Caption[]; direction: Direction; active: boolean; viewer?: boolean; ended?: boolean; readingTools?: React.ReactNode }) {
  const { t } = useLanguage();
  const scroll = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const latest = useRef<HTMLElement>(null);
  const [following, setFollowing] = useState(true);
  const followRef = useRef(true);
  const position = useRef<() => void>(() => {});
  const labels = DIRECTIONS[direction];
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || !content.current) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The breathing room permits even the first/last row to sit in the center.
        const padding = `${element.clientHeight / 2}px`;
        if (content.current) {
          content.current.style.paddingBlock = latest.current ? padding : "0px";
        }
        if (!followRef.current || !latest.current) return;
        const row = latest.current.getBoundingClientRect();
        const viewport = element.getBoundingClientRect();
        const top = row.top - viewport.top - element.clientTop + element.scrollTop;
        element.scrollTo({ top: captionScrollTarget(top, row.height, element.clientHeight), behavior: "instant" });
      });
    };
    position.current = update;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(content.current);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); position.current = () => {}; };
  }, []);
  useLayoutEffect(() => {
    if (!items.length) { followRef.current = true; setFollowing(true); }
    position.current();
  }, [items]);
  const pauseFollow = () => {
    followRef.current = false;
    setFollowing(false);
  };
  const resumeFollow = () => {
    followRef.current = true;
    setFollowing(true);
    position.current();
  };
  const mobileWindow = mobileCaptionWindow(items);
  return <section className={`caption-panel ${viewer ? "viewer-captions" : ""}`} aria-label={t("雙語字幕")}>
    <div className="panel-header"><div><span className="section-label">LIVE TRANSCRIPT</span><h2>{t("雙語逐字稿")}</h2></div><span className={`connection-pill ${active ? "online" : ""}`}><i/>{ended ? t("活動已結束") : active ? t("接收字幕中") : t("等待開始")}</span></div>
    <div className="caption-columns"><span><span className="language-symbol">{t("原")}</span>{t(labels.original)}</span><span><Languages size={15}/>{t(labels.translated)}</span></div>
    {viewer && <>
      <div className="mobile-reading-tools"><span>{t("最近 5 組字幕")}</span>{readingTools}</div>
      <div className="mobile-bilingual-live">
        <MobileLiveBilingual completed={mobileWindow.completed} pending={mobileWindow.pending} sourceLanguage={labels.source} targetLanguage={labels.target} active={!ended && active}/>
      </div>
    </>}
    <div className="caption-viewport">
    <div ref={scroll} className="caption-scroll" role="log" aria-live="polite" aria-relevant="additions text" tabIndex={0} onWheel={pauseFollow} onTouchMove={pauseFollow} onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) pauseFollow(); }}>
    <div ref={content} className="caption-content">
      {!items.length ? <div className="caption-empty"><div className="wave-emblem"><AudioLines size={44} strokeWidth={1}/></div><h3>{ended ? t("謝謝參與，這場對話已結束。") : active ? viewer ? t("字幕已連線，等候下一句發言") : t("準備好了，請開始說話") : viewer ? t("等候主持人開啟對話") : t("等待即時字幕")}</h3><p>{ended ? t("你可以關閉此頁面，或等待下一場活動的邀請。") : active ? t("原文與譯文將隨著發言，逐句出現在這裡。") : t("按下 Quick Start 後，原文與翻譯會顯示在這裡。")}</p><span className="empty-languages">{t("中文")}<span>↔</span>English</span></div> : items.map((item, index) => <article key={item.id} ref={index === items.length - 1 ? latest : undefined} className={`caption-row ${!item.final ? "interim" : ""} ${index === items.length - 1 ? "latest-caption" : ""}`}><div className="caption-index">{String(item.sequence ?? index + 1).padStart(2, "0")}</div><p className="original-text" lang={labels.source.startsWith("zh") ? "zh-Hant" : labels.source} data-label={t(labels.original)}>{traditionalChinese(item.original) || <span className="placeholder-text">{captionHint(labels.source, "recognizing")}</span>}</p><p className="translated-text" lang={labels.target.startsWith("zh") ? "zh-Hant" : labels.target} data-label={t(labels.translated)}>{traditionalChinese(item.translation) || <span className="placeholder-text"><span className="typing-dots">•••</span>{captionHint(labels.target, "translating")}</span>}{item.translation && !item.final && <span className="interim-dot" aria-label={captionHint(labels.target, "updating")}/>}</p></article>)}
    </div>
    </div>
    {!following && items.length > 0 && <button className="follow-latest-button" onClick={resumeFollow}><ArrowDown size={14}/>{t("回到最新字幕")}</button>}
    </div>
    <div className="panel-bottom"><span><i className="tiny-dot"/>{items.length ? t("本次連線 · 第 {first}–{last} 段", {first: items[0].sequence ?? 1, last: items.at(-1)?.sequence ?? items.length}) + ((items.at(-1)?.sequence ?? 0) > items.length ? t("（顯示最近 100 段）") : "") : t("字幕只在本次連線顯示")}</span><span>{t("不錄音 · 不錄影")}</span></div>
  </section>;
}
