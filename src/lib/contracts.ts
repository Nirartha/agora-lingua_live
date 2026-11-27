export type Direction = "zh-en" | "en-zh";
export type SessionStatus = "CREATED" | "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "ERROR" | "UNCERTAIN";
export const DIRECTIONS = {
  "zh-en": { source: "zh-CN", target: "en-US", label: "繁體中文 → English", original: "繁體中文原文", translated: "English translation" },
  "en-zh": { source: "en-US", target: "zh-CN", label: "English → 繁體中文", original: "English original", translated: "繁體中文翻譯" },
} as const;

export interface PublicSession {
  id: string;
  title: string;
  direction: Direction;
  status: SessionStatus;
  channel: string;
  hostUid: number;
  agentUid: number;
  generation: number;
  createdAt: number;
  startedAt?: number | null;
  expiresAt: number | null;
  stoppedAt?: number | null;
  runUntil: number | null;
  error: string | null;
}

export interface Session extends PublicSession {
  hostKeyHash: string;
  agentId: string | null;
  viewers: Record<string, { uid: number; createdAt: number }>;
  attemptId: string | null;
}

export interface JoinCredentials {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  expiresAt: number;
}

export function publicSession(session: Session): PublicSession {
  const { id, title, direction, status, channel, hostUid, agentUid, generation, createdAt, startedAt, stoppedAt, expiresAt, runUntil, error } = session;
  return { id, title, direction, status, channel, hostUid, agentUid, generation, createdAt, startedAt, stoppedAt, expiresAt, runUntil, error };
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
  CREATED: "準備開始", STARTING: "翻譯啟動中", RUNNING: "即時翻譯中", STOPPING: "停止中", STOPPED: "活動已結束", ERROR: "連線需要處理", UNCERTAIN: "啟動結果待確認",
};
