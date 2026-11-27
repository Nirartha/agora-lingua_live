import { NextResponse } from "next/server";
import { AppError } from "./config";

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AppError(415, "JSON_REQUIRED", "請使用 JSON 請求。");
  const text = await request.text();
  if (text.length > 4096) throw new AppError(413, "TOO_LARGE", "請求內容過大。");
  let body;
  try { body = JSON.parse(text); } catch { throw new AppError(400, "INVALID_JSON", "請求格式不正確。"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "INVALID_JSON", "請求格式不正確。");
  return body;
}
export function key(request: Request) { return request.headers.get("Authorization")?.replace(/^Bearer /, "") || ""; }
export function id(value: string) {
  if (!/^[a-f0-9]{24}$/.test(value)) throw new AppError(404, "NOT_FOUND", "找不到這場活動。");
  return value;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin) return; // Server-to-server and CLI requests do not carry Origin.
  // Next dev can use 0.0.0.0 internally even when the browser uses localhost.
  // Compare with the inbound Host, not the internal reconstructed request URL.
  const target = new URL(request.url);
  const host = request.headers.get("Host");
  if (host) target.host = host;
  if (origin !== target.origin) throw new AppError(403, "ORIGIN_REJECTED", "請從活動網站操作。");
}
export function publicOrigin(request: Request) {
  const target = new URL(request.url);
  const host = request.headers.get("Host");
  if (host) target.host = host;
  return target.origin;
}
export async function respond(request: Request, operation: () => Promise<unknown>) {
  try {
    assertSameOrigin(request);
    return NextResponse.json(await operation(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    // No raw exception/request logging: upstream data may contain tokens or credentials.
    return NextResponse.json({ error: "暫時無法完成操作，請稍後再試。", code: "INTERNAL_ERROR" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
