import { AppError } from "@/lib/server/config";
import { checkSecret, sessions } from "@/lib/server/sessions";
import { key, respond } from "@/lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return respond(request, async () => {
    if (!process.env.CLEANUP_SECRET || !checkSecret(key(request), process.env.CLEANUP_SECRET)) throw new AppError(403, "FORBIDDEN", "無法執行清理。");
    return { results: await sessions().cleanup() };
  });
}
