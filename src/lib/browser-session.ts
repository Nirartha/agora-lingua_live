import type { IAgoraRTCClient, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { RTMClient } from "agora-rtm";
import type { Caption } from "./transcripts";
import { TranscriptBuffer } from "./transcripts";
import type { JoinCredentials, PublicSession } from "./contracts";
import { SingleClient } from "./single-client";

declare global {
  interface Window { __linguaRtmClient?: SingleClient<RTMClient> }
}
function rtmClient() {
  return window.__linguaRtmClient ??= new SingleClient<RTMClient>();
}

interface Options {
  session: PublicSession;
  credentials: JoinCredentials;
  host: boolean;
  renew: () => Promise<JoinCredentials>;
  onCaptions: (captions: Caption[]) => void;
  onConnection: (state: string) => void;
  onError: (message: string) => void;
  onInputEnded?: () => void;
  microphoneId?: string;
  inputStream?: MediaStream;
  buffer?: TranscriptBuffer;
}
const sdkModules = {
  rtm: () => import("agora-rtm"),
  rtc: () => import("agora-rtc-sdk-ng"),
};

export class BrowserSession {
  private rtc?: IAgoraRTCClient;
  private microphone?: ILocalAudioTrack;
  private closed = false;
  private buffer: TranscriptBuffer;
  private renewing?: Promise<void>;
  private renewalTimer?: ReturnType<typeof setTimeout>;
  private expiresAt: number;
  private readonly owner = Symbol("subtitle connection");
  private detach: (() => void)[] = [];
  private subscribed = false;
  private inputEnded?: () => void;
  private rtmRecovering?: Promise<void>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private recoveryAttempts = 0;
  private async disconnectRtm(client: RTMClient) {
    for (const detach of this.detach.splice(0)) detach();
    this.subscribed = false;
    await client.unsubscribe(this.options.session.channel).catch(() => {});
    await client.logout().catch(() => {});
  }
  private requestRenewal = () => {
    if (this.closed) return;
    if (!this.renewing) {
      this.renewing = this.options.renew().then(async ({ token, expiresAt }) => {
        if (this.closed) return;
        await rtmClient().use(this.owner, async client => {
          if (!this.closed) await client.renewToken(token);
        });
        if (this.closed) return;
        if (this.rtc?.connectionState === "CONNECTED") await this.rtc.renewToken(token);
        if (this.closed) return;
        this.expiresAt = expiresAt;
        this.scheduleRenewal();
      }).catch(() => {
        if (!this.closed) {
          this.options.onError("連線憑證更新暫時失敗，15 秒後會重試。");
          clearTimeout(this.renewalTimer);
          this.renewalTimer = setTimeout(this.requestRenewal, 15000);
        }
      }).finally(() => { this.renewing = undefined; });
    }
  };
  constructor(private options: Options, private sdk = sdkModules) {
    this.expiresAt = options.credentials.expiresAt;
    this.buffer = options.buffer ?? new TranscriptBuffer();
  }
  private recoverRtm = (client: RTMClient, reason?: string) => {
    if (this.closed || this.rtmRecovering || reason === "SAME_UID_LOGIN") return;
    this.options.onConnection("字幕重新連線中");
    clearTimeout(this.recoveryTimer);
    this.rtmRecovering = rtmClient().use(this.owner, async () => {
      try {
        if (this.closed) return;
        const credentials = await this.options.renew();
        if (this.closed) return;
        await client.login({ token: credentials.token });
        if (this.closed) return;
        await client.subscribe(this.options.session.channel, { withMessage: true, withPresence: false });
        if (this.closed) return;
        if (this.rtc?.connectionState === "CONNECTED") await this.rtc.renewToken(credentials.token);
        if (this.closed) return;
        this.expiresAt = credentials.expiresAt;
        this.subscribed = true;
        this.recoveryAttempts = 0;
        this.options.onConnection("已連線");
        this.scheduleRenewal();
      } catch {
        if (!this.closed) {
          this.options.onError("字幕連線中斷，正在重試；請確認網路後等待幾秒。");
          this.recoveryTimer = setTimeout(() => this.recoverRtm(client), Math.min(30000, 3000 * 2 ** Math.min(this.recoveryAttempts++, 4)));
        }
      }
    }).then(() => {}).finally(() => { this.rtmRecovering = undefined; });
  };
  private scheduleRenewal() {
    clearTimeout(this.renewalTimer);
    if (!this.closed) this.renewalTimer = setTimeout(this.requestRenewal, Math.max(1000, this.expiresAt - Date.now() - 120000));
  }
  private assertOpen() { if (this.closed) throw new Error("連線已取消。"); }

  async connect() {
    try {
      const inputTrack = this.options.inputStream?.getAudioTracks()[0];
      if (this.options.inputStream) {
        if (!inputTrack || inputTrack.readyState === "ended") throw new Error("電腦音源已停止");
        this.inputEnded = () => { if (!this.closed) this.options.onInputEnded?.(); };
        for (const track of this.options.inputStream.getTracks()) track.addEventListener("ended", this.inputEnded);
      }
      const { default: AgoraRTM } = await this.sdk.rtm();
      this.assertOpen();
      const { credentials, session } = this.options;
      await rtmClient().open(this.owner, `${credentials.appId}:${credentials.uid}`, () => new AgoraRTM.RTM(credentials.appId, String(credentials.uid)), async (client) => {
      this.assertOpen();
      const messageListener = (event: import("agora-rtm").RTMEvents.MessageEvent) => {
        if (this.closed || event.channelName !== session.channel || event.publisher !== String(session.agentUid)) return;
        const captions = this.buffer.accept(event.publisher, event.message);
        if (captions) this.options.onCaptions(captions);
      };
      const linkListener = (event: import("agora-rtm").RTMEvents.LinkStateEvent) => {
        if (this.closed) return;
        this.options.onConnection(event.currentState === "CONNECTED" ? "已連線" : event.currentState === "CONNECTING" || event.currentState === "SUSPENDED" ? "重新連線中" : "字幕連線中斷");
        if (event.currentState === "CONNECTED") {
          clearTimeout(this.recoveryTimer);
          if (this.subscribed && !this.rtmRecovering && !event.isResumed) {
            void rtmClient().use(this.owner, async () => {
              if (!this.closed) await client.subscribe(session.channel, { withMessage: true, withPresence: false });
            }).catch(() => { if (!this.closed) this.options.onError("字幕訂閱未恢復，請按重新連線。"); });
          }
        }
        // Agora RTM automatically retries DISCONNECTED/SUSPENDED. Calling
        // login while that retry is active can create parallel sockets.
        if (event.currentState === "FAILED" && this.subscribed) this.recoverRtm(client, event.reasonCode);
      };
      client.addEventListener("message", messageListener);
      client.addEventListener("linkState", linkListener);
      client.addEventListener("tokenPrivilegeWillExpire", this.requestRenewal);
      this.detach.push(
        () => client.removeEventListener("message", messageListener),
        () => client.removeEventListener("linkState", linkListener),
        () => client.removeEventListener("tokenPrivilegeWillExpire", this.requestRenewal),
      );
      await client.login({ token: credentials.token });
      this.assertOpen();
      await client.subscribe(session.channel, { withMessage: true, withPresence: false });
      this.subscribed = true;
      this.assertOpen();
      }, (client) => this.disconnectRtm(client));

      if (this.options.host) {
        const { default: AgoraRTC } = await this.sdk.rtc();
        this.assertOpen();
        AgoraRTC.setLogLevel(3);
        this.rtc = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        this.rtc.on("token-privilege-will-expire", this.requestRenewal);
        this.rtc.on("token-privilege-did-expire", this.requestRenewal);
        this.rtc.on("connection-state-change", (state) => {
          if (!this.closed && state === "RECONNECTING") this.options.onConnection("音訊重新連線中");
        });
        await this.rtc.join(credentials.appId, session.channel, credentials.token, credentials.uid);
        this.assertOpen();
        this.microphone = inputTrack
          ? AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: inputTrack, encoderConfig: "speech_standard" })
          : await AgoraRTC.createMicrophoneAudioTrack({ ...(this.options.microphoneId ? { microphoneId: this.options.microphoneId } : {}), encoderConfig: "speech_standard" });
        this.assertOpen();
        await this.rtc.publish(this.microphone);
        this.assertOpen();
      }
      this.options.onConnection("已連線");
      this.scheduleRenewal();
      const checkExpiry = () => { if (!this.closed && this.expiresAt - Date.now() <= 120000) this.requestRenewal(); };
      document.addEventListener("visibilitychange", checkExpiry);
      window.addEventListener("online", checkExpiry);
      this.detach.push(() => document.removeEventListener("visibilitychange", checkExpiry), () => window.removeEventListener("online", checkExpiry));
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async mute(value: boolean) { await this.microphone?.setMuted(value); }
  volume() { return this.microphone?.getVolumeLevel() ?? 0; }
  stats() { return this.buffer.stats(); }
  async close() {
    this.closed = true;
    clearTimeout(this.renewalTimer);
    clearTimeout(this.recoveryTimer);
    this.microphone?.stop(); this.microphone?.close(); this.microphone = undefined;
    if (this.options.inputStream) {
      for (const track of this.options.inputStream.getTracks()) {
        if (this.inputEnded) track.removeEventListener("ended", this.inputEnded);
        track.stop();
      }
      this.inputEnded = undefined;
    }
    await this.rtc?.leave().catch(() => {});
    await rtmClient().close(this.owner, (client) => this.disconnectRtm(client));
  }
}

export async function microphones() {
  const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
  return AgoraRTC.getMicrophones(false);
}

/** Must be called directly from the Quick Start user gesture. */
export async function captureComputerAudio() {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("此瀏覽器不支援電腦音源分享，請使用最新版 Chrome 或 Edge。");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  // Keep the capture lifecycle intact: ending its video track can also end
  // audio in some browsers. Video is never published, rendered, or recorded.
  const audio = stream.getAudioTracks()[0];
  if (!audio) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("沒有取得分頁或螢幕音訊，請在分享視窗勾選「分享音訊」後重試。");
  }
  return { stream, audio };
}
