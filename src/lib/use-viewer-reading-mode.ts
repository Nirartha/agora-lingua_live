"use client";
import { useEffect, useState } from "react";

export function useViewerReadingMode() {
  const [flow, setFlow] = useState(false);
  useEffect(() => {
    try { setFlow(localStorage.getItem("lingua-viewer-flow") === "true"); } catch {}
  }, []);
  const toggleFlow = () => {
    setFlow(!flow);
    try { localStorage.setItem("lingua-viewer-flow", String(!flow)); } catch {}
  };
  return { flow, toggleFlow };
}
