import type { JoinCredentials, PublicSession } from "./contracts";

export async function api<T>(path: string, options: { method?: string; body?: unknown; key?: string; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method || "GET", cache: "no-store", signal: options.signal,
    headers: { ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(options.key ? { Authorization: `Bearer ${options.key}` } : {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "暫時無法完成操作。");
  return body as T;
}

export type Grant = { credentials: JoinCredentials; viewerKey?: string };
export type EventResult = { session: PublicSession };
