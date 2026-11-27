import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { type Direction, type Session, publicSession } from "../contracts";
import { AgoraService } from "./agora";
import { AppError, config } from "./config";
import { type State, type Store, store } from "./store";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const newKey = () => randomBytes(32).toString("hex");
const VALID_KEY = /^[a-f0-9]{64}$/;
export function checkSecret(value: string, expected: string) {
  return timingSafeEqual(Buffer.from(hash(value), "hex"), Buffer.from(hash(expected), "hex"));
}
function host(session: Session, key: string) {
  if (!VALID_KEY.test(key) || !checkSecret(hash(key), session.hostKeyHash)) throw new AppError(403, "HOST_REQUIRED", "這個操作需要主持人控制權。");
}
function find(state: State, id: string) {
  const session = state.sessions[id];
  if (!session) throw new AppError(404, "NOT_FOUND", "找不到這場活動，請確認分享網址。");
  // Upgrade a running room created by the former 30-minute pilot without
  // ending it or changing its UID, Agent, transcript generation or share URL.
  if (session.status === "RUNNING") {
    session.startedAt ??= session.runUntil ? session.runUntil - 30 * 60000 : session.createdAt;
    session.runUntil = null;
    session.expiresAt = null;
  }
  return session;
}
function available(session: Session) {
  if (session.expiresAt !== null && session.expiresAt <= Date.now()) throw new AppError(410, "EXPIRED", "活動已到期，請建立新活動。");
}
function nextUid(session?: Session) {
  const used = new Set(session ? [session.hostUid, session.agentUid, ...Object.values(session.viewers).map((v) => v.uid)] : []);
  let uid = randomInt(10000, 2000000000);
  while (used.has(uid)) uid = randomInt(10000, 2000000000);
  return uid;
}
export class SessionService {
  constructor(private database: Store, private agora: AgoraService) {}

  async create(title: string, direction: Direction) {
    return this.database.transaction(async (state) => {
      // Retain unresolved agents even after expiry, so they remain discoverable for cleanup.
      for (const [id, session] of Object.entries(state.sessions)) {
        if (session.expiresAt !== null && session.expiresAt < Date.now() && !session.agentId && !["STARTING", "UNCERTAIN"].includes(session.status)) delete state.sessions[id];
      }
      if (Object.keys(state.sessions).length >= 20) throw new AppError(429, "EVENT_LIMIT", "這個展示環境的活動數已達上限，請先清理舊活動。");
      const id = randomBytes(12).toString("hex");
      const hostKey = newKey();
      const session: Session = {
        id, title, direction, status: "CREATED", channel: `caption_${id}`, hostUid: nextUid(), agentUid: 0,
        generation: 0, createdAt: Date.now(), startedAt: null, expiresAt: Date.now() + 2 * 3600000, runUntil: null,
        error: null, hostKeyHash: hash(hostKey), agentId: null, viewers: {}, attemptId: null,
      };
      session.agentUid = nextUid(session);
      state.sessions[id] = session;
      return { session: publicSession(session), hostKey };
    });
  }

  async get(id: string) { return publicSession(find(await this.database.read(), id)); }

  async credentials(id: string, key: string, role: "host" | "viewer") {
    const allocation = await this.database.transaction(async (state) => {
      const session = find(state, id); available(session);
      if (role === "host") { host(session, key); return { session, uid: session.hostUid, key: undefined }; }
      if (session.status === "STOPPED") throw new AppError(410, "ENDED", "這場活動已結束。");
      let viewer = VALID_KEY.test(key) ? session.viewers[hash(key)] : undefined;
      let viewerKey: string | undefined;
      if (!viewer) {
        if (Object.keys(session.viewers).length >= 100) throw new AppError(429, "VIEWER_LIMIT", "這場展示活動已達觀眾上限。");
        viewerKey = newKey();
        viewer = { uid: nextUid(session), createdAt: Date.now() };
        session.viewers[hash(viewerKey)] = viewer;
      }
      return { session, uid: viewer.uid, key: viewerKey };
    });
    const credentials = await this.agora.token(allocation.session, allocation.uid, role);
    return { credentials, ...(allocation.key ? { viewerKey: allocation.key } : {}) };
  }

  async start(id: string, key: string) {
    const result = await this.database.transaction(async (state, checkpoint) => {
      const session = find(state, id); available(session); host(session, key);
      if (session.status === "RUNNING") {
        // A restored browser can outlive an Agent that was reclaimed while away.
        if (!session.agentId) return new AppError(409, "UNRESOLVED_AGENT", "活動的 Agent 狀態不完整，請先核對服務。");
        const remote = await this.agora.query(session.agentId);
        if (["STOPPED", "STOP", "TERMINATED"].includes(remote.status)) {
          session.status = "STOPPED"; session.agentId = null; session.runUntil = null;
          session.stoppedAt = Date.now(); session.expiresAt = Date.now() + 24 * 3600000;
          return new AppError(409, "AGENT_ENDED", "翻譯服務已結束，請建立新活動。");
        }
        if (remote.status !== "RUNNING") return new AppError(409, "AGENT_NOT_READY", "翻譯服務尚未就緒，請查詢狀態後再連線。");
        return publicSession(session);
      }
      if (session.agentId || ["STARTING", "STOPPING", "UNCERTAIN", "STOPPED"].includes(session.status)) {
        throw new AppError(409, "NOT_STARTABLE", "請先確認或停止既有翻譯。已結束的活動需重新建立。");
      }
      session.status = "STARTING"; session.attemptId = randomUUID(); session.error = null;
      await checkpoint(); // Journal before calling an external service.
      try {
        const joined = await this.agora.join(session);
        session.agentId = joined.agentId;
        session.status = "RUNNING";
        session.generation += 1;
        session.startedAt = Date.now();
        // No application-imposed runtime limit. Only explicit stop / service
        // lifecycle ends a running activity; draft expiry is no longer relevant.
        session.runUntil = null;
        session.expiresAt = null;
        try { await checkpoint(); }
        catch (error) { await this.agora.leave(joined.agentId).catch(() => {}); throw error; }
        return publicSession(session);
      } catch (error) {
        const failure = error instanceof AppError ? error : new AppError(502, "JOIN_UNCERTAIN", "啟動狀態待核對，請先查詢服務。");
        session.status = ["JOIN_UNCERTAIN", "LOCK_EXPIRED"].includes(failure.code) || session.agentId ? "UNCERTAIN" : "ERROR";
        session.error = failure.message;
        return failure;
      }
    });
    if (result instanceof AppError) throw result;
    return result;
  }

  async stop(id: string, key: string, cleanup = false) {
    const result = await this.database.transaction(async (state, checkpoint) => {
      const session = find(state, id);
      if (!cleanup) host(session, key);
      if (session.status === "STOPPED") return publicSession(session);
      if (!session.agentId && ["STARTING", "UNCERTAIN"].includes(session.status)) throw new AppError(409, "UNRESOLVED_AGENT", "Agent 建立結果未知，請先核對服務後台；系統不會假裝已停止。");
      if (session.agentId) {
        session.status = "STOPPING"; await checkpoint();
        try { await this.agora.leave(session.agentId); }
        catch (error) {
          const failure = error instanceof AppError ? error : new AppError(502, "STOP_FAILED", "停止尚未成功，請重試。");
          session.error = failure.message; return failure;
        }
      }
      session.agentId = null; session.runUntil = null; session.status = "STOPPED"; session.error = null;
      session.stoppedAt = Date.now(); session.expiresAt = Date.now() + 24 * 3600000;
      return publicSession(session);
    });
    if (result instanceof AppError) throw result;
    return result;
  }

  async query(id: string, key: string) {
    const session = find(await this.database.read(), id); host(session, key);
    const remote = session.agentId ? await this.agora.query(session.agentId) : { status: "NO_KNOWN_AGENT" };
    if (["STOPPED", "STOP", "TERMINATED"].includes(remote.status)) {
      return this.database.transaction(async (state) => {
        const fresh = find(state, id);
        if (fresh.agentId === session.agentId) { fresh.agentId = null; fresh.status = "STOPPED"; fresh.runUntil = null; fresh.error = null; fresh.stoppedAt = Date.now(); fresh.expiresAt = Date.now() + 24 * 3600000; }
        return { session: publicSession(fresh), remoteStatus: remote.status };
      });
    }
    return { session: publicSession(session), remoteStatus: remote.status };
  }

  async cleanup() {
    const state = await this.database.read();
    const due = Object.values(state.sessions).filter((s) => s.status !== "STOPPED" && s.status !== "RUNNING" && (s.status === "STOPPING" || s.expiresAt !== null && s.expiresAt <= Date.now()));
    const results = [];
    // Bound each invocation; retain records for the next cleanup invocation on failure.
    for (const session of due.slice(0, 3)) {
      try { await this.stop(session.id, "", true); results.push({ id: session.id, stopped: true }); }
      catch { results.push({ id: session.id, stopped: false }); }
    }
    return results;
  }
}

export function sessions() { return new SessionService(store(), new AgoraService(config())); }
