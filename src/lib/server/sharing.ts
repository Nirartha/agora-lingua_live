import { readFile } from "node:fs/promises";
import path from "node:path";
import { isPhoneShareUrl } from "../share-url";

export async function sharingStatus() {
  if (process.env.SITE_URL) {
    return { shareBaseUrl: isPhoneShareUrl(process.env.SITE_URL) ? new URL(process.env.SITE_URL).origin : null };
  }
  // Temporary viewer tunnel is a local development feature, never a cloud fallback.
  if (!process.env.VERCEL) {
    try {
      const saved = JSON.parse(await readFile(path.join(process.cwd(), ".data", "public-viewer.json"), "utf8"));
      if (isPhoneShareUrl(saved.url) && Number.isInteger(saved.port) && saved.port >= 1024 && saved.port <= 65535 && /^[a-f0-9]{64}$/.test(saved.healthKey)) {
        const response = await fetch(`http://127.0.0.1:${saved.port}/__health`, { cache: "no-store", signal: AbortSignal.timeout(1500), headers: { Authorization: `Bearer ${saved.healthKey}` } });
        if (response.ok) return { shareBaseUrl: new URL(saved.url).origin };
      }
    } catch { /* Closed tunnel or gateway: do not generate a misleading localhost QR. */ }
  }
  return { shareBaseUrl: null };
}
