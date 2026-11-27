export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const required = ["AGORA_APP_ID", "TOKEN_BUILDER_URL", "AGORA_CUSTOMER_ID", "AGORA_CUSTOMER_SECRET"] as const;
export function setupStatus() {
  const missing: string[] = required.filter((key) => !process.env[key]?.trim());
  if (process.env.VERCEL) {
    for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "DEMO_ACCESS_CODE", "CLEANUP_SECRET", "SITE_URL"]) {
      if (!process.env[key]?.trim()) missing.push(key);
    }
  }
  return { ready: missing.length === 0, missing, storage: process.env.UPSTASH_REDIS_REST_URL ? "redis" : "local", local: !process.env.VERCEL, requiresAccessCode: !!process.env.DEMO_ACCESS_CODE };
}

export function config() {
  if (!setupStatus().ready) throw new AppError(503, "SETUP_REQUIRED", "請先完成本機環境設定，再開始活動。");
  const appId = process.env.AGORA_APP_ID!.trim();
  if (!/^[\da-f]{32}$/i.test(appId)) throw new AppError(503, "INVALID_APP_ID", "App ID 格式不正確，請檢查環境設定。");
  const apiBase = process.env.AGORA_API_BASE_URL || "https://api.agora.io";
  const base = new URL(apiBase);
  if (base.protocol !== "https:" || !["api.agora.io", "api-ap-southeast-1.agora.io", "api-test.agora.io"].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw new AppError(503, "INVALID_API_BASE", "請使用文件列出的 Agora API 區域網址。");
  }
  const builder = new URL(process.env.TOKEN_BUILDER_URL!);
  if (builder.protocol !== "https:" || builder.username || builder.password || builder.search || builder.hash) {
    throw new AppError(503, "INVALID_BUILDER_URL", "Token Builder 請使用不含 query 或憑證的 HTTPS 網址。");
  }
  return {
    appId, apiBase: base.origin, builderUrl: builder.toString(),
    customerId: process.env.AGORA_CUSTOMER_ID!, customerSecret: process.env.AGORA_CUSTOMER_SECRET!,
    preset: process.env.AGORA_V2V_PRESET || "v2vt_base",
  };
}
