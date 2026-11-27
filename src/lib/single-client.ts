/** Serializes login/logout and retains one SDK instance for one page identity. */
export class SingleClient<T> {
  private cached?: { identity: string; client: T };
  private owner?: symbol;
  private tail: Promise<unknown> = Promise.resolve();

  private run<R>(operation: () => Promise<R>): Promise<R> {
    const result = this.tail.then(operation, operation);
    this.tail = result.catch(() => {});
    return result;
  }

  open(owner: symbol, identity: string, create: () => T, initialize: (client: T) => Promise<void>, cleanup: (client: T) => Promise<void>) {
    return this.run(async () => {
      if (this.cached && this.cached.identity !== identity) throw new Error("連線身分已變更，請重新整理頁面後再開始。");
      if (this.owner) throw new Error("上一個字幕連線仍在使用中，請稍後重試。");
      this.cached ??= { identity, client: create() };
      const client = this.cached.client;
      this.owner = owner;
      try { await initialize(client); return client; }
      catch (error) {
        try { await cleanup(client); } finally { this.owner = undefined; }
        throw error;
      }
    });
  }

  close(owner: symbol, cleanup: (client: T) => Promise<void>) {
    return this.run(async () => {
      // A stale React effect must never log out a later connection.
      if (this.owner !== owner || !this.cached) return;
      try { await cleanup(this.cached.client); } finally { this.owner = undefined; }
    });
  }

  /** Serialize recovery and renewal with close/login for the current owner. */
  use<R>(owner: symbol, operation: (client: T) => Promise<R>) {
    return this.run(async () => {
      if (this.owner !== owner || !this.cached) return;
      return operation(this.cached.client);
    });
  }
}
