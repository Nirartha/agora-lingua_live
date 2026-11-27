export const VIEWER_REVISION = "release-1";

type VisualFrame = { width: number; height: number; offsetLeft: number; offsetTop: number; scale: number };

/** VisualViewport can lag behind the CSS viewport on older iOS. Never enlarge
 * the native container using its measurements, or apply rotation offsets. */
export function viewerFrame(width: number, height: number, visual?: VisualFrame | null) {
  const positive = (value: number | undefined, fallback: number) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
  return {
    width: Math.min(width, positive(visual?.width, width)),
    height: Math.min(height, positive(visual?.height, height)),
  };
}
