"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate, type Locale, type Params } from "@/lib/i18n";

const LanguageContext = createContext({ locale: "zh-TW" as Locale, setLocale: (_locale: Locale) => {}, t: (text: string, params?: Params) => translate("zh-TW", text, params) });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("zh-TW");
  const setLocale = useCallback((value: Locale) => {
    updateLocale(value);
    try { localStorage.setItem("lingua-ui-language", value); } catch { /* Storage may be restricted. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", value);
    window.history.replaceState(window.history.state, "", url);
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("lang");
    let saved: string | null = null;
    try { saved = localStorage.getItem("lingua-ui-language"); } catch {}
    const initial = query === "en" || query === "zh-TW" ? query : saved;
    if (initial === "en" || initial === "zh-TW") updateLocale(initial);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hant";
    const title = locale === "en" ? "Lingua Live · Live Bilingual Captions" : "Lingua Live · 即時雙語字幕";
    // Next can finish streaming its default metadata after client hydration.
    const syncTitle = () => { if (document.title !== title) document.title = title; };
    const observer = new MutationObserver(syncTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    syncTitle();
    return () => observer.disconnect();
  }, [locale]);
  const t = useCallback((text: string, params?: Params) => translate(locale, text, params), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
