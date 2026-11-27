import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { AgoraService } from "../src/lib/server/agora";
import type { Session } from "../src/lib/contracts";

test("Agent token lasts 24 hours, browser tokens remain one hour for renewal", async () => {
  const settings = {appId:"1".repeat(32),apiBase:"https://api.agora.io",builderUrl:"https://example.invalid",customerId:"fake",customerSecret:"fake",preset:"v2vt_base"};
  const calls: URL[]=[];
  const fakeFetch = (async (input: URL | RequestInfo) => {
    const url=new URL(String(input));calls.push(url);
    const app=Buffer.from(settings.appId), size=Buffer.alloc(2);size.writeUInt16LE(app.length);
    const bytes=Buffer.concat([Buffer.alloc(2),size,app]);
    return Response.json({token:"007"+deflateSync(bytes).toString("base64"),role:url.searchParams.get("role")});
  }) as typeof fetch;
  const service=new AgoraService(settings,fakeFetch);
  const session={channel:"test"} as Session;
  const before=Date.now();
  for(const role of ["host","viewer","stt"] as const){
    const result=await service.token(session,123,role);
    const ttl=role==="stt"?86400:3600;
    assert.equal(calls.at(-1)!.searchParams.get("expireTime"),String(ttl));
    assert.ok(result.expiresAt>=before+ttl*1000);
    assert.equal(calls.at(-1)!.searchParams.get("uid"),"123");
  }
});
