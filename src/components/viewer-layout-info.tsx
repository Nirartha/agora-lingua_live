"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useState, type RefObject } from "react";
import { VIEWER_REVISION } from "@/lib/viewer-frame";

/** Opt-in measurements for investigating a device screenshot; no session data. */
export function ViewerLayoutInfo({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState("");
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const v = window.visualViewport, element = root.current, r = element?.getBoundingClientRect();
      const main = element?.querySelector<HTMLElement>(".viewer-main"), panel = element?.querySelector<HTMLElement>(".viewer-captions");
      const style = element && getComputedStyle(element);
      const n = (value?: number) => Math.round(value || 0);
      setInfo([
        VIEWER_REVISION,
        `${t("容器")} ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}`,
        `${t("螢幕")} ${screen.width}×${screen.height}` ,
        `${t("視窗")} ${window.innerWidth}×${window.innerHeight}`,
        `${t("可見")} ${n(v?.width)}×${n(v?.height)} · ${t("縮放")} ${(v?.scale || 1).toFixed(2)}`,
        `${t("偏移")} ${n(v?.offsetLeft)},${n(v?.offsetTop)}`,
        `${t("頁框")} ${n(r?.width)}×${n(r?.height)} @ ${n(r?.left)},${n(r?.top)}`,
        `${t("文件")} ${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight}`,
        `${t("水平溢出")} ${Math.max(0, (element?.scrollWidth || 0) - (element?.clientWidth || 0))}px`,
        `${t("主區域")} ${main?.clientWidth || 0}/${main?.scrollWidth || 0}`,
        `${t("字幕區")} ${panel?.clientWidth || 0}/${panel?.scrollWidth || 0}`,
        `${t("安全區內距")} ${style?.paddingTop || "0"} ${style?.paddingRight || "0"} ${style?.paddingBottom || "0"} ${style?.paddingLeft || "0"}`,
      ].join("\n"));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure); };
  }, [open, root, t]);
  return <details className="viewer-layout-info" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{t("版面資訊")}</summary><pre>{info}</pre>
  </details>;
}
