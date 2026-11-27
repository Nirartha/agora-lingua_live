"use client";
import { useLayoutEffect, useRef } from "react";
import { viewerFrame } from "./viewer-frame";

/** iOS browser chrome and rotation can resize visualViewport before 100dvh settles. */
export function useViewerViewport() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let frame = 0;
    let timers: ReturnType<typeof setTimeout>[] = [];
    // A native CSS containing block remains authoritative when WebKit's
    // visualViewport is stale during rotation. No hard-coded device dimensions.
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none;";
    probe.setAttribute("aria-hidden", "true");
    document.body.appendChild(probe);
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = viewerFrame(probe.clientWidth || window.innerWidth, probe.clientHeight || window.innerHeight, window.visualViewport);
        // Width and position are entirely CSS-owned. Native pinch zoom is kept.
        const zooming = (window.visualViewport?.scale || 1) > 1.05;
        root.current?.style.setProperty("--viewer-height", zooming ? `${probe.clientHeight}px` : `${bounds.height}px`);
      });
    };
    // WebKit can report transient sizes before the rotation animation settles.
    const settle = () => {
      timers.forEach(clearTimeout);
      resize();
      timers = [60, 180, 400, 900, 1500].map((delay) => setTimeout(resize, delay));
    };
    resize();
    window.addEventListener("resize", resize); window.addEventListener("orientationchange", settle);
    window.addEventListener("pageshow", settle);
    document.addEventListener("visibilitychange", settle);
    window.screen.orientation?.addEventListener("change", settle);
    window.visualViewport?.addEventListener("resize", resize); window.visualViewport?.addEventListener("scroll", resize);
    return () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout); probe.remove(); window.removeEventListener("resize", resize); window.removeEventListener("orientationchange", settle); window.removeEventListener("pageshow", settle); document.removeEventListener("visibilitychange", settle); window.screen.orientation?.removeEventListener("change", settle); window.visualViewport?.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("scroll", resize); };
  }, []);
  return root;
}
