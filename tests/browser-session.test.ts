import assert from "node:assert/strict";
import { test } from "node:test";
import { BrowserSession } from "../src/lib/browser-session";
import { TranscriptBuffer } from "../src/lib/transcripts";
import type { PublicSession } from "../src/lib/contracts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  Object.defineProperty(globalThis, "window", {configurable:true, value:new EventTarget()});
  Object.defineProperty(globalThis, "document", {configurable:true, value:new EventTarget()});
  const calls: string[] = [];
  const events = new Map<string, Set<(event: any) => void>>();
  let nextLogin: ReturnType<typeof deferred> | undefined;
  class FakeRtm {
    addEventListener(name: string, callback: (event: any) => void) {if(!events.has(name))events.set(name,new Set());events.get(name)!.add(callback);}
    removeEventListener(name: string, callback: (event: any) => void) {events.get(name)?.delete(callback);}
    async login() { calls.push("login"); const wait=nextLogin;nextLogin=undefined;await wait?.promise; emit("linkState",{currentState:"CONNECTED",isResumed:false}); }
    async logout() {calls.push("logout");}
    async subscribe() {calls.push("subscribe");}
    async unsubscribe() {calls.push("unsubscribe");}
    async renewToken() {calls.push("renewToken");}
  }
  const emit = (name: string, event: any) => {for(const callback of events.get(name)||[])callback(event);};
  const rtm = async () => ({default:{RTM:FakeRtm}} as unknown as typeof import("agora-rtm"));
  const session = {id:"test",channel:"channel",agentUid:22,hostUid:11,generation:1} as PublicSession;
  const credentials = {appId:"app",channel:"channel",uid:11,token:"test-token",expiresAt:Date.now()+3600000};
  const states: string[]=[];
  const options = {session,credentials,host:false,renew:async()=>credentials,onCaptions:()=>{},onConnection:(state:string)=>states.push(state),onError:()=>{}};
  return {calls,emit,states,options,sdk:{rtm,rtc:()=>import("agora-rtc-sdk-ng")},holdLogin:()=>{nextLogin=deferred();return nextLogin;}};
}

test("RTM uses SDK retry for transient disconnect, and one subscribe for terminal recovery", async () => {
  const f=fixture(), connection=new BrowserSession(f.options,f.sdk);
  await connection.connect();
  f.emit("linkState",{currentState:"DISCONNECTED",reasonCode:"CONNECTION_ERROR"});
  f.emit("linkState",{currentState:"SUSPENDED",reasonCode:"RECONNECT_TIMEOUT"});
  await tick();assert.equal(f.calls.filter(x=>x==='login').length,1);
  f.emit("linkState",{currentState:"FAILED",reasonCode:"CONNECTION_ERROR"});
  await tick();await tick();
  assert.equal(f.calls.filter(x=>x==='login').length,2);
  assert.equal(f.calls.filter(x=>x==='subscribe').length,2);
  await connection.close();
});

test("close serializes behind recovery; an old session cannot subscribe after closing", async () => {
  const f=fixture(), old=new BrowserSession(f.options,f.sdk); await old.connect();
  const gate=f.holdLogin(); f.emit("linkState",{currentState:"FAILED",reasonCode:"CONNECTION_ERROR"});await tick();
  const closing=old.close(); await tick(); assert.equal(f.calls.includes('logout'),false);
  gate.resolve();await closing;
  assert.equal(f.calls.filter(x=>x==='subscribe').length,1);
  const next=new BrowserSession(f.options,f.sdk);await next.connect();
  assert.deepEqual(f.calls.slice(-4),['unsubscribe','logout','login','subscribe']);
  await next.close();
});

test("source reselection shares one transcript buffer and keeps sequence and corrections", async () => {
  const f=fixture(), buffer=new TranscriptBuffer();let rows: ReturnType<TranscriptBuffer['items']>=[];
  const options={...f.options,buffer,onCaptions:(items:typeof rows)=>{rows=items;}};
  const message=(turn:number,text:string)=>f.emit('message',{channelName:'channel',publisher:'22',message:JSON.stringify({object:'user.translation',stream_id:11,turn_id:turn,text,transcript_text:`原文${turn}。`,language:'en-US',transcript_language:'zh-CN',final:true})});
  const first=new BrowserSession(options,f.sdk);await first.connect();message(1,'First sentence.');await first.close();
  const second=new BrowserSession(options,f.sdk);await second.connect();message(2,'Second sentence.');
  assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>x.sequence),[1,2]);
  message(1,'Corrected first sentence.');assert.equal(rows.length,2);assert.equal(rows[0].translation,'Corrected first sentence.');
  await second.close();
});

test("same UID takeover never triggers automatic relogin", async () => {
  const f=fixture(), connection=new BrowserSession(f.options,f.sdk);await connection.connect();
  f.emit('linkState',{currentState:'FAILED',reasonCode:'SAME_UID_LOGIN'});await tick();
  assert.equal(f.calls.filter(x=>x==='login').length,1);await connection.close();
});

test("closing during initial login immediately releases all raw display-capture tracks", async () => {
  const f=fixture(), gate=f.holdLogin();let stops=0;
  class FakeTrack extends EventTarget {readyState='live';stop(){stops++;this.readyState='ended';}}
  const audio=new FakeTrack(),video=new FakeTrack();
  const inputStream={getAudioTracks:()=>[audio],getTracks:()=>[audio,video]} as unknown as MediaStream;
  const connection=new BrowserSession({...f.options,host:true,inputStream},f.sdk);
  const connecting=connection.connect();await tick();
  const closing=connection.close();assert.equal(stops,2);
  gate.resolve();await assert.rejects(connecting,/取消/);await closing;
  assert.equal(f.calls.includes('subscribe'),false);
});
