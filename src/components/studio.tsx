"use client";
import { useLanguage } from "./language-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AudioLines, Check, ChevronDown, Clock3, Copy, ExternalLink, Globe2, Languages, LoaderCircle, Mic, MicOff, Monitor, QrCode, Radio, RotateCcw, Settings2, ShieldCheck, Square, Subtitles, Wifi, X, Zap } from "lucide-react";
import { Brand, Footer } from "./brand";
import { Captions } from "./captions";
import { TranscriptStage } from "./transcript-stage";
import { TranscriptDownloads } from "./transcript-downloads";
import { useHostArchive } from "@/lib/use-host-archive";
import { archiveId } from "@/lib/transcript-archive";
import { api, type EventResult, type Grant } from "@/lib/client";
import { BrowserSession, captureComputerAudio, microphones } from "@/lib/browser-session";
import { STATUS_LABELS, type Direction, type PublicSession } from "@/lib/contracts";
import { TranscriptBuffer, type Caption } from "@/lib/transcripts";
import { sessionElapsed } from "@/lib/session-clock";
import { localizedEventTitle, localizedUrl } from "@/lib/i18n";
import { isPhoneShareUrl } from "@/lib/share-url";

type Room = { session: PublicSession; hostKey: string; viewerUrl: string };
type Setup = { ready: boolean; missing: string[]; local: boolean; storage: string; requiresAccessCode: boolean; shareBaseUrl: string | null };
const SAVED_ROOM = "lingua-host-room";

export function Studio() {
  const { locale, t } = useLanguage();
  const archive = useHostArchive();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("zh-en");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState("尚未連線");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const [audioSource, setAudioSource] = useState<"microphone" | "computer">("microphone");
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(true);
  const connectionRef = useRef<BrowserSession | null>(null);
  const closingRef = useRef<Promise<void>>(Promise.resolve());
  const captionBuffer = useRef<{ key: string; buffer: TranscriptBuffer } | null>(null);
  const roomRef = useRef<Room | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  const saveRoom = useCallback((value: Room | null) => {
    if (value) {
      const url = new URL(value.viewerUrl);
      if (url.hostname === "0.0.0.0") {
        url.host = window.location.host; url.protocol = window.location.protocol;
        value = { ...value, viewerUrl: url.toString() };
      }
    }
    roomRef.current = value; setRoom(value);
    if (value) sessionStorage.setItem(SAVED_ROOM, JSON.stringify(value));
    else sessionStorage.removeItem(SAVED_ROOM);
  }, []);
  const refreshSetup = useCallback(() => {
    api<Setup>("/api/setup").then(setSetup).catch(() => setError("無法讀取服務狀態，請重新整理頁面。"));
  }, []);
  useEffect(() => {
    mounted.current = true;
    refreshSetup();
    const sharingTimer = setInterval(refreshSetup, 10000);
    try {
      const saved = sessionStorage.getItem(SAVED_ROOM);
      if (saved) {
        const value = JSON.parse(saved) as Room;
        if (value.session?.id && value.hostKey) {
          saveRoom(value);
          setTitle(value.session.title); setDirection(value.session.direction);
        }
      }
    } catch { sessionStorage.removeItem(SAVED_ROOM); }
    return () => { mounted.current = false; clearInterval(sharingTimer); void connectionRef.current?.close(); };
  }, [refreshSetup, saveRoom]);

  useEffect(() => {
    if (!room?.session.id) return;
    let alive = true;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const data = await api<EventResult>(`/api/events/${room.session.id}`, { signal: controller.signal });
        if (!alive || !roomRef.current) return;
        saveRoom({ ...roomRef.current, session: data.session });
        if (data.session.status === "STOPPED") {
          await connectionRef.current?.close(); connectionRef.current = null; setConnected(false); setLevel(0); setConnection("活動已結束");
        }
      } catch { /* A temporary status request failure must not tear down live media. */ }
    };
    void poll(); const timer = setInterval(poll, 5000);
    return () => { alive = false; controller.abort(); clearInterval(timer); };
  }, [room?.session.id, saveRoom]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLevel(connectionRef.current?.volume() ?? 0);
      setElapsed(sessionElapsed(roomRef.current?.session ?? null));
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const eventTitle = localizedEventTitle(title ?? "一場跨越語言的對話", locale);
  const begin = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy("準備連線"); setError("");
    let current = roomRef.current;
    let computerAudio: Awaited<ReturnType<typeof captureComputerAudio>> | undefined;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices) throw new Error("麥克風需要 HTTPS 或 localhost，請從安全網址開啟。");
      if (audioSource === "computer") {
        setBusy("選擇電腦音源");
        computerAudio = await captureComputerAudio();
      }
      if (!current) {
        current = await api<Room>("/api/events", { method: "POST", body: { title: eventTitle, direction, accessCode } });
        saveRoom(current);
      }
      const credentialsForRoom = async () => (await api<Grant>(`/api/events/${current!.session.id}/tokens`, { method: "POST", body: { role: "host" }, key: current!.hostKey })).credentials;
      const credentials = await credentialsForRoom();
      await closingRef.current;
      await connectionRef.current?.close();
      const bufferKey = `${current.session.id}:${Math.max(1, current.session.generation)}`;
      if (captionBuffer.current?.key !== bufferKey) captionBuffer.current = { key: bufferKey, buffer: new TranscriptBuffer() };
      const transport = new BrowserSession({
        session: current.session, credentials, host: true, microphoneId: microphoneId || undefined, inputStream: computerAudio?.stream, buffer: captionBuffer.current.buffer,
        renew: credentialsForRoom, onCaptions: (items) => {
          setCaptions(items);
          archive.capture(roomRef.current?.session || current!.session, items);
        }, onConnection: setConnection, onError: setError,
        onInputEnded: () => {
          if (audioSource !== "computer" || connectionRef.current !== transport) return;
          setConnection("電腦音源已停止");
          setError("電腦／分頁音訊已停止，請重新選擇音訊來源並按重新連線。");
          setConnected(false); setMuted(false); setLevel(0);
          connectionRef.current = null;
          closingRef.current = transport.close();
        },
      });
      connectionRef.current = transport; setBusy(audioSource === "computer" ? "連接電腦音源" : "連接麥克風");
      await transport.connect();
      if (!mounted.current) { await transport.close(); return; }
      setBusy("啟動即時翻譯");
      const result = await api<EventResult>(`/api/events/${current.session.id}/start`, { method: "POST", key: current.hostKey });
      saveRoom({ ...current, session: result.session });
      if (!mounted.current || connectionRef.current !== transport) return;
      setConnected(true); setMuted(false);
    } catch (reason) {
      computerAudio?.stream.getTracks().forEach((track) => track.stop());
      await connectionRef.current?.close(); connectionRef.current = null; setConnected(false); setLevel(0);
      setError(reason instanceof Error ? reason.message : "無法開始翻譯，請確認麥克風與服務設定。");
      if (current) {
        try { const data = await api<EventResult>(`/api/events/${current.session.id}`); saveRoom({ ...current, session: data.session }); } catch {}
      }
    } finally { setBusy(""); busyRef.current = false; }
  };

  const stop = async () => {
    const current = roomRef.current;
    if (!current || busyRef.current) return;
    busyRef.current = true; setBusy("停止翻譯"); setError("");
    // Release capture even if the REST stop fails. Keep the room for stop retry.
    await connectionRef.current?.close(); connectionRef.current = null;
    await archive.flush().catch(() => {});
    setConnected(false); setMuted(false); setLevel(0);
    try {
      const result = await api<EventResult>(`/api/events/${current.session.id}/stop`, { method: "POST", key: current.hostKey });
      saveRoom({ ...current, session: result.session }); setConnection("活動已結束");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "停止尚未完成，請再次嘗試。"); }
    finally { setBusy(""); busyRef.current = false; }
  };

  const inspectAgent = async () => {
    if (!room || busyRef.current) return;
    busyRef.current = true; setBusy("查詢服務");
    try {
      const result = await api<EventResult & { remoteStatus: string }>(`/api/events/${room.session.id}/agent`, { method: "POST", key: room.hostKey });
      saveRoom({ ...room, session: result.session });
      setError(result.remoteStatus === "NO_KNOWN_AGENT" ? "尚無可查詢的 Agent ID，請在 Agora 服務後台核對這場活動；不要重複建立。" : t("服務查詢結果：{status}", {status: result.remoteStatus}));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "查詢失敗。"); }
    finally { setBusy(""); busyRef.current = false; }
  };
  const newRoom = async () => {
    if (room && room.session.status !== "STOPPED") { setError("請先停止目前活動，再建立新活動。"); return; }
    await connectionRef.current?.close(); connectionRef.current = null;
    try { await archive.flush(); }
    catch { setError("文字尚未保存成功，請先下載或重試保存，再建立新活動。"); return; }
    saveRoom(null); captionBuffer.current = null; setCaptions([]); setConnected(false); setError(""); setConnection("尚未連線");
    // RTM 2.3 retains constructor identity registrations even after logout.
    // New activity = new user identity, therefore start a fresh page SDK scope.
    window.location.assign(localizedUrl("/", locale));
  };

  const live = room?.session.status === "RUNNING" && connected;
  const needsStop = !!room && ["RUNNING", "STARTING", "STOPPING", "UNCERTAIN"].includes(room.session.status);
  const ended = room?.session.status === "STOPPED";
  const viewerUrl = room ? localizedUrl(new URL(`/event/${room.session.id}`, setup?.shareBaseUrl || room.viewerUrl).toString(), locale) : "";
  const phoneSharingReady = !!setup?.shareBaseUrl && isPhoneShareUrl(viewerUrl || setup.shareBaseUrl);
  const localViewerPath = room ? `/event/${room.session.id}` : "";
  const canShare = !!room && room.session.status === "RUNNING";
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(viewerUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError("無法自動複製，請使用下方觀眾網址。"); }
  };
  const toggleMicrophone = async () => {
    try { await connectionRef.current?.mute(!muted); setMuted(!muted); }
    catch { setError("麥克風控制失敗，請重試。"); }
  };

  return (
    <div className="app-shell studio-shell">
      <Brand channel={room?.session.channel} displayUrl={localViewerPath ? localizedUrl(`${localViewerPath}?view=display`, locale) : undefined} subtitleUrl={localViewerPath ? localizedUrl(`${localViewerPath}?view=subtitle`, locale) : undefined} onQrClick={() => setQrOpen(!qrOpen)} />
      <main className="studio-main">
        <div className="session-toolbar">
          <div className="toolbar-identity"><span className="gradient-label">LIVE TRANSLATION</span><span className="toolbar-divider"/><span className="toolbar-project">Agora V2V</span><span className={`session-status ${live ? "is-live" : ""}`}><i/>{t(busy || (room ? STATUS_LABELS[room.session.status] : "尚未開始"))}</span></div>
          <div className="session-clock" title={t("活動已進行時間")}><Clock3 size={15}/><span>{elapsed}</span></div>
          <div className="toolbar-actions">
            <button className={`tool-button ${settingsOpen ? "selected" : ""}`} aria-label={t("進階設定")} aria-pressed={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={17}/></button>
            {needsStop && <button className="stop-button" disabled={!!busy} onClick={() => void stop()}><Square size={12} fill="currentColor"/>{t("停止")}</button>}
            {ended ? <button className="primary-button" onClick={() => void newRoom()}><RotateCcw size={15}/>{t("建立新活動")}</button> : !connected && !["STARTING", "STOPPING", "UNCERTAIN"].includes(room?.session.status || "") ? <button className="primary-button" disabled={!setup?.ready || !!busy || !eventTitle.trim()} onClick={() => void begin()}>{busy ? <LoaderCircle size={16} className="spinning"/> : <Zap size={16}/>}<span>{t(busy || (room?.session.status === "RUNNING" ? "重新連線" : "Quick Start"))}</span></button> : connected ? <span className="live-indicator"><i/>LIVE</span> : null}
          </div>
        </div>
        {error && <div className="notice error" role="alert"><span>{t(error)}</span><button aria-label={t("關閉提示")} onClick={() => setError("")}><X size={17}/></button></div>}
        {setup && !setup.ready && <div className="notice setup-notice"><Settings2 size={18}/><div><strong>{t("服務尚未設定完成")}</strong><p>{t("請設定 .env.local 中的 {fields}。", {fields: setup.missing.join(", ")})}</p></div><button className="text-button" onClick={refreshSetup}>{t("重新檢查")}<RotateCcw size={14}/></button></div>}

        <div className={`workspace ${qrOpen ? "" : "without-share"}`}>
          <aside className="agent-sidebar">
            <section className="agent-panel">
              <div className="agent-visual"><span className="agent-heading">Translation Agent</span><div className={`agent-orb ${live && !muted ? "active" : ""}`}><div className="agent-glow"/><AudioLines size={34} strokeWidth={1.2}/></div><div className="agent-wave" aria-label={t("麥克風音量")}>{Array.from({ length: 16 }, (_, i) => <i key={i} className={live && !muted && level * 26 > i ? "lit" : ""} style={{ height: `${5 + (i % 5) * 3}px` }}/>)}</div><span className="agent-caption">{live ? muted ? t("麥克風已靜音") : t("正在聆聽與翻譯") : t("等待音訊輸入")}</span></div>
              <div className="device-controls"><div className="control-label-row"><span>{audioSource === "computer" ? "COMPUTER AUDIO" : "MICROPHONE"}</span><button className={`mic-toggle ${muted ? "muted" : ""}`} disabled={!connected} aria-label={muted ? t("恢復麥克風") : t("靜音麥克風")} onClick={() => void toggleMicrophone()}>{muted ? <MicOff size={18}/> : <Mic size={18}/>}</button></div><div className="audio-source-select"><Mic size={14}/><select aria-label={t("音訊來源")} value={audioSource} disabled={!!busy || connected} onChange={(e) => setAudioSource(e.target.value as "microphone" | "computer")}><option value="microphone">{t("麥克風")}</option><option value="computer">{t("電腦／分頁音訊")}</option></select><ChevronDown size={13}/></div>{audioSource === "microphone" ? <div className="device-select"><Mic size={14}/><select aria-label={t("麥克風裝置")} value={microphoneId} disabled={!!busy || connected} onChange={(e) => setMicrophoneId(e.target.value)}><option value="">{t("系統預設麥克風")}</option>{devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || t("麥克風裝置")}</option>)}</select><button className="device-refresh" disabled={!!busy || connected} aria-label={t("重新整理麥克風裝置")} onClick={() => { void microphones().then(setDevices).catch(() => setError("無法讀取麥克風裝置，請確認瀏覽器權限。")); }}><RotateCcw size={13}/></button></div> : <p className="audio-source-help">{t("開始後選擇播放音訊的分頁並勾選分享音訊。系統／OBS 音訊支援依瀏覽器與作業系統而定。")}</p>}<div className="audio-meter"><span>INPUT LEVEL</span><div>{Array.from({ length: 25 }, (_, i) => <i key={i} className={live && !muted && level * 35 > i ? "lit" : ""}/>)}</div></div></div>
              <div className="agent-settings"><label>{t("活動名稱")}<input value={eventTitle} onChange={(e) => setTitle(e.target.value)} maxLength={80} disabled={!!room || !!busy} placeholder={t("輸入活動名稱")}/></label><label>{t("翻譯方向")}<div className="select-wrap"><Languages size={15}/><select aria-label={t("翻譯方向")} value={direction} onChange={(e) => setDirection(e.target.value as Direction)} disabled={!!room || !!busy}><option value="zh-en">{t("繁體中文 → English")}</option><option value="en-zh">{t("English → 繁體中文")}</option></select><ChevronDown size={13}/></div></label><div className="mode-info"><span><Subtitles size={14}/>{t("雙語字幕")}</span><span className="off-badge">TTS OFF</span></div>{setup?.requiresAccessCode && !room && <label>{t("展示控制碼")}<input type="password" autoComplete="off" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder={t("輸入展示控制碼")}/></label>}</div>
              {settingsOpen && <div className="advanced-settings"><span className="section-label">SESSION DETAILS</span><dl><div><dt>Connection</dt><dd>{t(connection)}</dd></div><div><dt>Host UID</dt><dd>{room?.session.hostUid || "—"}</dd></div><div><dt>Agent UID</dt><dd>{room?.session.agentUid || "—"}</dd></div><div><dt>Agent role</dt><dd>stt</dd></div><div><dt>Transport</dt><dd>RTC + RTM</dd></div></dl>{room && <button className="secondary-button" onClick={() => void inspectAgent()} disabled={!!busy}><Radio size={13}/>{t("查詢服務狀態")}</button>}</div>}
              <div className="agent-bottom"><ShieldCheck size={13}/><span>{t("不錄音・不錄影・中文繁體呈現")}</span></div>
            </section>
          </aside>

          <TranscriptStage tools={<TranscriptDownloads archives={archive.archives} currentId={room ? archiveId(room.session) : undefined} flush={archive.flush} error={archive.error} saving={archive.saving}/>}><Captions items={captions} direction={room?.session.direction || direction} active={!!live} ended={!!ended}/></TranscriptStage>

          {qrOpen && <aside className="share-sidebar"><section className="share-card"><div className="share-heading"><QrCode size={16}/><h2>Mobile subtitles</h2></div><p className="share-description">{t("掃碼加入，在自己的裝置同步查看原文與翻譯。")}</p><div className={`qr-frame ${canShare && phoneSharingReady ? "qr-ready" : ""}`}>{canShare && phoneSharingReady ? <QRCodeSVG value={viewerUrl} size={168} level="M" marginSize={3} bgColor="#ffffff" fgColor="#11151e"/> : <div className="qr-unavailable"><QrCode size={48} strokeWidth={1}/><span>{ended ? t("活動已結束") : !phoneSharingReady ? t("等待 HTTPS 分享入口") : t("開始後顯示 QR Code")}</span></div>}</div><div className={`share-state ${phoneSharingReady ? "ready" : ""}`}><i/>{phoneSharingReady ? t("HTTPS 分享已就緒") : t("手機分享尚未啟用")}</div>
          {canShare && phoneSharingReady && <><button className="share-button" onClick={() => void copyLink()}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? t("已複製觀眾連結") : t("複製手機連結")}</button><a className="open-viewer" href={viewerUrl} target="_blank" rel="noreferrer">{t("開啟觀眾頁")}<ExternalLink size={12}/></a><p className="viewer-url">{viewerUrl}</p></>}
          {!phoneSharingReady && <div className="share-help"><p>{t("啟用公開 HTTPS 連線後，這裡會自動產生手機可用的 QR Code。")}</p><button className="text-button" onClick={refreshSetup}><RotateCcw size={12}/>{t("檢查分享連線")}</button></div>}
          <div className="share-divider"/><ul className="share-benefits"><li><Globe2 size={14}/>{t("手機、平板、電腦")}</li><li><Languages size={14}/>{t("原文與譯文同步")}</li><li><ShieldCheck size={14}/>{t("不需註冊或開啟麥克風")}</li></ul>{room && <div className="view-links"><a href={localizedUrl(`${localViewerPath}?view=display`, locale)} target="_blank" rel="noreferrer"><Monitor size={13}/>{t("顯示模式")}<ExternalLink size={11}/></a><a href={localizedUrl(`${localViewerPath}?view=subtitle`, locale)} target="_blank" rel="noreferrer"><Subtitles size={13}/>{t("字幕模式")}<ExternalLink size={11}/></a></div>}</section></aside>}
        </div>
        <div className="studio-statusbar"><span><Wifi size={12}/>{t(connection)}<span className="status-separator">|</span>RTC · RTM · V2V</span><span>{room ? `Session ${room.session.id.slice(0, 8)}` : "Ready to connect"}<span className="status-separator">|</span>{t("繁體中文 ↔ English")}</span></div>
      </main><Footer/>
    </div>
  );
}
