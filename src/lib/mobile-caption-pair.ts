import type { Caption } from "./transcripts";

/** Keep a small recent mobile window; the host archive still keeps all text. */
export function mobileCaptionWindow(items: Caption[], limit = 5) {
  const latest = items.at(-1);
  const pending = latest && !latest.final ? latest : undefined;
  const completed = items.filter((item) => item.final).slice(-limit);
  return { completed, pending };
}
