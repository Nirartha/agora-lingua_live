import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Redis } from '@upstash/redis';
import { RedisStore, store } from '../src/lib/server/store';
import { setupStatus } from '../src/lib/server/config';

function memoryRedis() {
  const values = new Map<string, unknown>();
  const client = {
    get: async (key: string) => values.get(key),
    set: async (key: string, value: unknown) => {
      if (values.has(key)) return null;
      values.set(key,value);return 'OK';
    },
    eval: async (_script: string, keys: string[], args: string[]) => {
      if (values.get(keys[0]) !== args[0]) return 0;
      if (keys.length === 2) values.set(keys[1], JSON.parse(args[1]));
      else values.delete(keys[0]);
      return 1;
    },
  } as unknown as Pick<Redis,'get'|'set'|'eval'>;
  return {client,values};
}
test('Redis state persists checkpoints and namespaces isolate preview and production', async () => {
  const f=memoryRedis(), prod=new RedisStore(f.client,'prod'), preview=new RedisStore(f.client,'preview');
  await assert.rejects(prod.transaction(async(state,checkpoint)=>{
    await checkpoint();
    await assert.rejects(prod.transaction(async()=>{}), /另一個操作/);
    throw new Error('after checkpoint');
  }),/after checkpoint/);
  assert.ok(f.values.has('prod:events:v1'));assert.equal(f.values.has('prod:lock:v1'),false);
  assert.deepEqual(await preview.read(),{sessions:{}});
  await preview.transaction(async()=>{});assert.ok(f.values.has('preview:events:v1'));
});
test('lost Redis lock cannot write state or delete the next owners lock', async () => {
  const f=memoryRedis(), db=new RedisStore(f.client,'test');
  await assert.rejects(db.transaction(async(_state,checkpoint)=>{
    f.values.set('test:lock:v1','new-owner');await checkpoint();
  }), /操作狀態尚未確認/);
  assert.equal(f.values.get('test:lock:v1'),'new-owner');assert.equal(f.values.has('test:events:v1'),false);
});
test('Vercel refuses local-file fallback and reports missing cloud settings', () => {
  const keys=['VERCEL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','DEMO_ACCESS_CODE','CLEANUP_SECRET','SITE_URL'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    for(const key of keys)delete process.env[key];process.env.VERCEL='1';
    assert.throws(()=>store(), /活動狀態儲存/);
    const status=setupStatus();assert.equal(status.ready,false);
    assert.ok(status.missing.includes('SITE_URL'));assert.ok(status.missing.includes('DEMO_ACCESS_CODE'));
  } finally {for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
