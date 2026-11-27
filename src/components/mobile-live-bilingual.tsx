"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "./language-provider";
import { ArrowDown } from "lucide-react";
import { captionHint } from "@/lib/i18n";
import { traditionalChinese } from "@/lib/chinese";
import type { Caption } from "@/lib/transcripts";

export function MobileLiveBilingual({ completed, pending, sourceLanguage, targetLanguage, active }: { completed: Caption[]; pending?: Caption; sourceLanguage: string; targetLanguage: string; active: boolean }) {
  const { t } = useLanguage();
  const scroll = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const snapshot = useRef({ completed, pending });
  const touchY = useRef<number | null>(null);
  if (following) snapshot.current = { completed, pending };
  // Freeze the small visible window while reading. Otherwise removing the
  // oldest pair would shift the reader even with auto-follow disabled.
  const reading = following ? { completed, pending } : snapshot.current;
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || !following) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "instant" });
  }, [following, completed, pending?.id, pending?.original, pending?.translation]);
  const pause = () => setFollowing(false);
  const onScroll = () => {
    const element = scroll.current;
    if (!element || following) return;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 8) setFollowing(true);
  };
  const source = sourceLanguage.startsWith("zh") ? "zh-Hant" : sourceLanguage;
  const target = targetLanguage.startsWith("zh") ? "zh-Hant" : targetLanguage;
  return <div className="mobile-live-bilingual-frame"><div ref={scroll} className="mobile-live-bilingual-scroll" role="log" aria-live="polite" tabIndex={0} onWheel={event => {if(event.deltaY < 0) pause();}} onTouchStart={event => {touchY.current=event.touches[0]?.clientY ?? null;}} onTouchMove={event => {if(touchY.current !== null && event.touches[0]?.clientY > touchY.current) pause();}} onKeyDown={event => {if(["ArrowUp","PageUp","Home"].includes(event.key))pause();}} onScroll={onScroll}>
    {reading.completed.map((item) => <article key={item.id} className="mobile-live-pair"><p className="mobile-live-original" lang={source}>{traditionalChinese(item.original)}</p><p className="mobile-live-translation" lang={target}>{traditionalChinese(item.translation) || captionHint(targetLanguage, "translating")}</p></article>)}
    {reading.pending && <article className="mobile-live-pair is-pending"><p className="mobile-live-original" lang={source}>{traditionalChinese(reading.pending.original) || captionHint(sourceLanguage, "recognizing")}</p><p className="mobile-live-translation" lang={target}>{traditionalChinese(reading.pending.translation) || captionHint(targetLanguage, "translating")}{active && <span className="interim-dot" role="status" aria-label={captionHint(targetLanguage, "updating")}/>}</p></article>}
    {!reading.completed.length && !reading.pending && <p className="mobile-live-empty">{captionHint(sourceLanguage, "waiting")}</p>}
  </div>{!following && <button className="mobile-follow-latest-button" onClick={() => setFollowing(true)}><ArrowDown size={14}/>{t("回到最新字幕")}</button>}</div>;
}
