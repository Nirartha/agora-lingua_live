import { AppError } from "@/lib/server/config";
import { id, jsonBody, key, respond } from "@/lib/server/http";
import { sessions } from "@/lib/server/sessions";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return respond(request, async () => {
    const body = await jsonBody(request);
    const role = body.role ?? "viewer";
    if (role !== "host" && role !== "viewer") throw new AppError(403, "INVALID_ROLE", "觀眾不能申請服務 Bot 身分。");
    return sessions().credentials(id((await context.params).eventId), key(request), role);
  });
}
