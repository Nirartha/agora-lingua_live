import type { PublicSession } from "./contracts";
import type { Caption } from "./transcripts";
import type { ArchiveInfo } from "./transcript-export";

const DATABASE = "agora-caption-archives-v1";
type StoredCaption = Caption & { archiveId: string };
let opening: Promise<IDBDatabase> | undefined;
function request<T>(value: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}
function done(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("文字儲存未完成"));
  });
}
function database() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("這個瀏覽器不支援本機文字保存，請改用一般模式的 Chrome 或 Safari。"));
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const value = indexedDB.open(DATABASE, 1);
      value.onupgradeneeded = () => {
        const db = value.result;
        db.createObjectStore("archives", { keyPath: "id" });
        const rows = db.createObjectStore("captions", { keyPath: ["archiveId", "id"] });
        rows.createIndex("archiveId", "archiveId");
      };
      value.onsuccess = () => {
        const db = value.result;
        db.onversionchange = () => { db.close(); opening = undefined; };
        resolve(db);
      };
      value.onerror = () => reject(value.error);
      value.onblocked = () => reject(new Error("文字資料庫被其他舊分頁占用，請關閉舊分頁後重試。"));
    }).catch(error => { opening = undefined; throw error; });
  }
  return opening;
}

export function archiveId(session: PublicSession) { return `${session.id}:${Math.max(1, session.generation)}`; }
export function archiveInfo(session: PublicSession): ArchiveInfo {
  const now = Date.now();
  return { id: archiveId(session), eventId: session.id, generation: Math.max(1, session.generation), title: session.title, direction: session.direction, startedAt: session.startedAt || session.createdAt, firstCapturedAt: now, savedAt: now, count: 0 };
}
export async function listArchives() {
  const db = await database();
  const tx = db.transaction("archives", "readonly"), finished = done(tx);
  const result = await request(tx.objectStore("archives").getAll()) as ArchiveInfo[];
  await finished;
  return result.sort((a, b) => b.savedAt - a.savedAt);
}
export async function readArchive(id: string) {
  const db = await database();
  const tx = db.transaction(["archives", "captions"], "readonly"), finished = done(tx);
  const infoRequest = tx.objectStore("archives").get(id);
  const rowsRequest = tx.objectStore("captions").index("archiveId").getAll(id);
  const [info, rows] = await Promise.all([request(infoRequest), request(rowsRequest)]) as [ArchiveInfo | undefined, StoredCaption[]];
  await finished;
  return info ? { info, captions: rows.map(({ archiveId: _archive, ...caption }) => caption) } : null;
}

export async function saveCaptions(info: ArchiveInfo, captions: Caption[]) {
  const db = await database();
  const tx = db.transaction(["archives", "captions"], "readwrite"), finished = done(tx);
  const archiveStore = tx.objectStore("archives"), rows = tx.objectStore("captions");
  // IDB serializes readwrite transactions: two flushes/tabs cannot lose row counts.
  const lookup = archiveStore.get(info.id);
  let saved: ArchiveInfo;
  lookup.onsuccess = () => {
    const previous = lookup.result as ArchiveInfo | undefined;
    saved = { ...info, firstCapturedAt: Math.min(previous?.firstCapturedAt ?? info.firstCapturedAt, info.firstCapturedAt), savedAt: Date.now(), count: 0 };
    let remaining = captions.length;
    const countRows = () => {
      const count = rows.index("archiveId").count(info.id);
      count.onsuccess = () => { saved.count = count.result; archiveStore.put(saved); };
    };
    for (const caption of captions) {
      const existing = rows.get([info.id, caption.id]);
      existing.onsuccess = () => {
        const old = existing.result as StoredCaption | undefined;
        // Never replace a completed saved segment with a stale interim snapshot.
        if (!old?.final || caption.final) rows.put({ ...caption, archiveId: info.id, receivedAt: Math.min(old?.receivedAt ?? caption.receivedAt, caption.receivedAt) });
        if (--remaining === 0) countRows();
      };
    }
    if (!captions.length) countRows();
  };
  await finished;
  return saved!;
}

/** Retains changed rows until IDB commits; the live renderer still keeps 100. */
export class ArchiveWriter {
  private pending = new Map<string, Caption>();
  private fingerprints = new Map<string, string>();
  private timer?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<void>;
  constructor(public info: ArchiveInfo, private changed: (info: ArchiveInfo) => void, private failed: (error: Error) => void, private persist = saveCaptions) {}
  capture(captions: Caption[]) {
    for (const caption of captions) {
      const signature = JSON.stringify(caption);
      if (this.fingerprints.get(caption.id) === signature) continue;
      this.fingerprints.set(caption.id, signature);
      this.pending.set(caption.id, { ...caption });
    }
    if (this.pending.size && !this.timer) this.timer = setTimeout(() => { this.timer = undefined; void this.flush().catch(() => {}); }, 400);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer); this.timer = undefined;
    if (this.inFlight) return this.inFlight.then(() => this.flush());
    if (!this.pending.size) return Promise.resolve();
    const batch = [...this.pending.values()]; this.pending.clear();
    this.inFlight = this.persist(this.info, batch).then(info => { this.info = info; this.changed(info); }).catch(error => {
      for (const caption of batch) if (!this.pending.has(caption.id)) this.pending.set(caption.id, caption);
      this.failed(error instanceof Error ? error : new Error("文字儲存失敗"));
      throw error;
    }).finally(() => { this.inFlight = undefined; });
    return this.inFlight.then(() => this.pending.size ? this.flush() : undefined);
  }
}
