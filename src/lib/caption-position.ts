/** Place a short caption's center, or a long caption's live tail, at eye level. */
export function captionScrollTarget(rowTop: number, rowHeight: number, viewportHeight: number) {
  const anchor = rowHeight <= viewportHeight * 0.65 ? rowHeight / 2 : Math.max(0, rowHeight - 32);
  return Math.max(0, rowTop + anchor - viewportHeight / 2);
}
