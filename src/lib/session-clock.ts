import type { PublicSession } from "./contracts";

export function sessionElapsed(session: PublicSession | null, now = Date.now()) {
  const start = session?.startedAt;
  if (!start) return "00:00:00";
  const end = session.status === "STOPPED" ? session.stoppedAt ?? start : now;
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, "0")).join(":");
}
