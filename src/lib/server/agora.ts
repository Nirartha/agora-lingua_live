import { randomUUID } from "node:crypto";
import { DIRECTIONS, type Session } from "../contracts";
import { AppError, config } from "./config";

type Settings = ReturnType<typeof config>;
export interface AgentJoin { agentId: string; requestId: string }

export class AgoraService {
  constructor(private settings: Settings, private fetcher: typeof fetch = fetch) {}

  async token(session: Session, uid: number, role: "host" | "viewer" | "stt") {
    const url = new URL(this.settings.builderUrl);
    // Browser clients renew every hour; the cloud Agent gets a separate 24h
    // credential. Browser renewToken does not renew the Agent's credential.
    const ttl = role === "stt" ? 86400 : 3600;
    url.search = new URLSearchParams({ channelName: session.channel, uid: String(uid), userUuid: String(uid), role, expireTime: String(ttl) }).toString();
    let response: Response;
    try {
      response = await this.fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(10000), headers: process.env.TOKEN_BUILDER_API_KEY ? { Authorization: `Bearer ${process.env.TOKEN_BUILDER_API_KEY}` } : {} });
    } catch { throw new AppError(502, "BUILDER_UNREACHABLE", "暫時無法取得連線憑證，請稍後再試。"); }
    if (!response.ok) throw new AppError(502, "BUILDER_REJECTED", `Token 服務未成功回應（HTTP ${response.status}）。`);
    let body;
    try { body = await response.json(); } catch { throw new AppError(502, "INVALID_TOKEN_RESPONSE", "Token 服務回應格式不正確。"); }
    if (typeof body.token !== "string" || !body.token.startsWith("007") || body.role && body.role !== role) {
      throw new AppError(502, "INVALID_TOKEN_RESPONSE", "Token 服務未提供預期憑證，請確認使用目前的 Builder。");
    }
    // The legacy response omits appId. Check the signed envelope before clients join.
    const { inflateSync } = await import("node:zlib");
    try {
      const bytes = inflateSync(Buffer.from(body.token.slice(3), "base64"), { maxOutputLength: 16384 });
      const offset = 2 + bytes.readUInt16LE(0);
      const size = bytes.readUInt16LE(offset);
      if (bytes.subarray(offset + 2, offset + 2 + size).toString() !== this.settings.appId) throw new Error();
    } catch { throw new AppError(502, "TOKEN_PROJECT_MISMATCH", "Builder Token 與本機 App ID 不一致，請確認使用同一個 Agora Project。"); }
    return { appId: this.settings.appId, channel: session.channel, uid, token: body.token, expiresAt: Date.now() + ttl * 1000 };
  }

  private headers(requestId?: string) {
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${this.settings.customerId}:${this.settings.customerSecret}`).toString("base64")}`,
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    };
  }
  private url(suffix: string) { return `${this.settings.apiBase}/api/speech-to-speech-translation/v2/projects/${this.settings.appId}${suffix}`; }

  async join(session: Session): Promise<AgentJoin> {
    const credentials = await this.token(session, session.agentUid, "stt");
    const direction = DIRECTIONS[session.direction];
    const requestId = session.attemptId || randomUUID();
    let response;
    try {
      response = await this.fetcher(this.url("/join"), {
        method: "POST", headers: this.headers(requestId), signal: AbortSignal.timeout(20000), cache: "no-store",
        body: JSON.stringify({ name: `captions-${session.id}-${requestId.slice(0, 8)}`, preset: this.settings.preset, properties: {
          channel: session.channel, token: credentials.token,
          agent_rtc_uid: String(session.agentUid), agent_rtm_uid: String(session.agentUid),
          remote_rtc_uids: [String(session.hostUid)], idle_timeout: 60,
          advanced_features: { enable_rtm: true }, parameters: { data_channel: "rtm" },
          asr: { language: direction.source }, translation: { language: direction.target }, tts: { enable: false },
        } }),
      });
    } catch { throw new AppError(504, "JOIN_UNCERTAIN", "啟動結果尚未確認。請勿重複啟動，先在服務後台核對這場活動。"); }
    if (!response.ok) {
      if (response.status >= 500 || response.status === 408 || response.status === 409) throw new AppError(502, "JOIN_UNCERTAIN", `翻譯啟動結果待核對（HTTP ${response.status}），請勿重複啟動。`);
      throw new AppError(502, "JOIN_REJECTED", `翻譯服務拒絕啟動（HTTP ${response.status}），請檢查 Project、REST 憑證與服務開通設定。`);
    }
    let body;
    try { body = await response.json(); } catch { throw new AppError(502, "JOIN_UNCERTAIN", "啟動回應不完整，請先核對服務後台。"); }
    if (typeof body.agent_id !== "string" || !body.agent_id) throw new AppError(502, "JOIN_UNCERTAIN", "服務未回傳 Agent 識別，請先核對後台。");
    return { agentId: body.agent_id, requestId };
  }

  async leave(agentId: string) {
    let response;
    try { response = await this.fetcher(this.url(`/agents/${encodeURIComponent(agentId)}/leave`), { method: "POST", headers: this.headers(), signal: AbortSignal.timeout(20000), cache: "no-store" }); }
    catch { throw new AppError(502, "STOP_FAILED", "尚未確認翻譯服務已停止，請保留活動並重試停止。"); }
    if (!response.ok && response.status !== 404) throw new AppError(502, "STOP_FAILED", `停止尚未成功（HTTP ${response.status}），請稍後重試。`);
  }

  async query(agentId: string) {
    let response;
    try { response = await this.fetcher(this.url(`/agents/${encodeURIComponent(agentId)}`), { headers: this.headers(), signal: AbortSignal.timeout(10000), cache: "no-store" }); }
    catch { throw new AppError(502, "QUERY_FAILED", "暫時無法查詢翻譯狀態。"); }
    if (response.status === 404) return { status: "STOPPED" };
    if (!response.ok) throw new AppError(502, "QUERY_FAILED", "翻譯狀態查詢未成功。");
    const body = await response.json();
    return { status: String(body.status || "UNKNOWN") };
  }
}
