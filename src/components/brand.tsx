"use client";
import { useLanguage } from "./language-provider";
import { AudioLines, Clipboard, Languages, Monitor, QrCode, Subtitles } from "lucide-react";
import { localizedUrl } from "@/lib/i18n";

interface Props {
  viewer?: boolean;
  channel?: string;
  displayUrl?: string;
  subtitleUrl?: string;
  onQrClick?: () => void;
}
export function Brand({ viewer = false, channel, displayUrl, subtitleUrl, onQrClick }: Props) {
  const { locale, setLocale, t } = useLanguage();
  return <header className="topbar">
    <a href={viewer ? undefined : localizedUrl("/", locale)} className="brand" aria-label={t("Agora 即時翻譯工作室")}><span className="brand-mark"><AudioLines size={18}/></span><span className="brand-title">TRANSLATION LAB</span><span className="brand-divider"/><span className="agora-wordmark">agora</span></a>
    <div className="channel-name"><Clipboard size={14}/><span>Channel Name:</span><strong>{channel || (viewer ? t("觀眾字幕") : t("尚未建立"))}</strong></div>
    <nav className="topbar-tools" aria-label={t("顯示工具")}>
      <button className="tool-button language-toggle" aria-label={locale === "en" ? t("切換為繁體中文") : "Switch to English"} title={locale === "en" ? t("切換為繁體中文") : "Switch to English"} onClick={() => setLocale(locale === "en" ? "zh-TW" : "en")}><Languages size={16}/><span>{locale === "en" ? t("繁中") : "EN"}</span></button>
      {displayUrl ? <a className="tool-button" title={t("開啟顯示模式")} aria-label={t("開啟顯示模式")} href={displayUrl} target="_blank" rel="noreferrer"><Monitor size={19}/></a> : <button className="tool-button" disabled aria-label={t("開啟顯示模式")}><Monitor size={19}/></button>}
      {subtitleUrl ? <a className="tool-button" title={t("開啟字幕模式")} aria-label={t("開啟字幕模式")} href={subtitleUrl} target="_blank" rel="noreferrer"><Subtitles size={19}/></a> : <button className="tool-button" disabled aria-label={t("開啟字幕模式")}><Subtitles size={19}/></button>}
      {onQrClick && <button className="tool-button" aria-label={t("顯示或隱藏手機 QR Code")} title={t("手機 QR Code")} onClick={onQrClick}><QrCode size={18}/></button>}
      <span className="topbar-role">{viewer ? "VIEWER" : "HOST"}</span>
    </nav>
  </header>;
}

export function Footer() {
  const { t } = useLanguage();
  return <footer className="footer"><span>Agora Real-time Translation</span><span>{t("繁體中文")} · English<span className="footer-dot">·</span>{t("文字字幕模式")}</span></footer>;
}
