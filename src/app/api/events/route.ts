import { AppError, config } from "@/lib/server/config";
import { jsonBody, publicOrigin, respond } from "@/lib/server/http";
import { checkSecret, sessions } from "@/lib/server/sessions";
import { sharingStatus } from "@/lib/server/sharing";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return respond(request, async () => {
    config();
    const body = await jsonBody(request);
    if (process.env.DEMO_ACCESS_CODE && (typeof body.accessCode !== "string" || !checkSecret(body.accessCode, process.env.DEMO_ACCESS_CODE))) throw new AppError(403, "ACCESS_DENIED", "展示控制碼不正確。");
    if (body.direction !== "zh-en" && body.direction !== "en-zh") throw new AppError(400, "INVALID_DIRECTION", "請選擇中英翻譯方向。");
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 80) throw new AppError(400, "INVALID_TITLE", "請輸入 1～80 字的活動名稱。");
    const result = await sessions().create(body.title.trim(), body.direction);
    const base = (await sharingStatus()).shareBaseUrl || publicOrigin(request);
    const viewerUrl = new URL(`/event/${result.session.id}`, base).toString();
    return { ...result, viewerUrl };
  });
}
