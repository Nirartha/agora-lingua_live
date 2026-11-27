import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { Session } from "../contracts";
import { AppError } from "./config";

export interface State { sessions: Record<string, Session> }
export interface Store {
  read(): Promise<State>;
  transaction<T>(operation: (state: State, checkpoint: () => Promise<void>) => Promise<T>): Promise<T>;
}
const empty = (): State => ({ sessions: {} });

export class FileStore implements Store {
  constructor(private directory = path.join(process.cwd(), ".data")) {}
  async read(): Promise<State> {
    try { return JSON.parse(await readFile(path.join(this.directory, "events.json"), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty(); throw error; }
  }
  async transaction<T>(operation: (state: State, checkpoint: () => Promise<void>) => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lockPath = path.join(this.directory, "events.lock");
    let handle;
    try { handle = await open(lockPath, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new AppError(409, "BUSY", "另一個操作正在處理，請稍後再試。");
      throw error;
    }
    const temporary = path.join(this.directory, `${randomUUID()}.tmp`);
    try {
      const state = await this.read();
      const checkpoint = async () => {
        await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
        await rename(temporary, path.join(this.directory, "events.json"));
      };
      const result = await operation(state, checkpoint);
      await checkpoint();
      return result;
    } finally {
      await handle.close();
      await rm(lockPath, { force: true });
      await rm(temporary, { force: true });
    }
  }
}

export class RedisStore implements Store {
  constructor(
    private client: Pick<Redis, "get" | "set" | "eval"> = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! }),
    private prefix = process.env.REDIS_KEY_PREFIX || "captions",
  ) {}
  async read(): Promise<State> { return (await this.client.get<State>(`${this.prefix}:events:v1`)) || empty(); }
  async transaction<T>(operation: (state: State, checkpoint: () => Promise<void>) => Promise<T>): Promise<T> {
    const owner = randomUUID();
    const acquired = await this.client.set(`${this.prefix}:lock:v1`, owner, { nx: true, px: 90000 });
    if (!acquired) throw new AppError(409, "BUSY", "另一個操作正在處理，請稍後再試。");
    try {
      const state = await this.read();
      const checkpoint = async () => {
        const saved = await this.client.eval(
        "if redis.call('get',KEYS[1])==ARGV[1] then redis.call('set',KEYS[2],ARGV[2]); return 1 else return 0 end",
        [`${this.prefix}:lock:v1`, `${this.prefix}:events:v1`], [owner, JSON.stringify(state)],
      );
        if (!saved) throw new AppError(503, "LOCK_EXPIRED", "操作狀態尚未確認，請查詢活動後再試。");
      };
      const result = await operation(state, checkpoint);
      await checkpoint();
      return result;
    } finally {
      await this.client.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", [`${this.prefix}:lock:v1`], [owner]);
    }
  }
}

export function store(): Store {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return new RedisStore();
  if (process.env.VERCEL) throw new AppError(503, "STORAGE_REQUIRED", "雲端部署需要設定活動狀態儲存。");
  return new FileStore();
}
