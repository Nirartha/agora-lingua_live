export type Locale = "zh-TW" | "en";
export type Params = Record<string, string | number>;
export const EN: Record<string, string> = {
  "文件": "Document", "水平溢出": "Horizontal overflow", "主區域": "Main (client/scroll)", "字幕區": "Captions (client/scroll)", "安全區內距": "Safe padding",
  "Agora 即時翻譯工作室": "Agora Live Translation Studio",
  "觀眾字幕": "Audience captions", "尚未建立": "Not created", "顯示工具": "Display tools",
  "開啟顯示模式": "Open display mode", "開啟字幕模式": "Open subtitle mode",
  "顯示或隱藏手機 QR Code": "Show or hide mobile QR code", "手機 QR Code": "Mobile QR code",
  "文字字幕模式": "Text captions", "繁體中文": "Traditional Chinese", "中文": "Chinese", "英文": "English", "中英雙語": "Chinese + English",
  "繁體中文 → English": "Traditional Chinese → English", "English → 繁體中文": "English → Traditional Chinese",
  "中文 ↔ English": "Chinese ↔ English", "繁體中文 ↔ English": "Traditional Chinese ↔ English",
  "繁體中文原文": "Traditional Chinese original", "繁體中文翻譯": "Traditional Chinese translation",
  "雙語字幕": "Bilingual captions", "雙語逐字稿": "Bilingual transcript", "原": "SRC",
  "活動已結束": "Event ended", "接收字幕中": "Receiving captions", "等待開始": "Waiting to start",
  "準備開始": "Ready to start", "翻譯啟動中": "Starting translation", "即時翻譯中": "Translating live",
  "停止中": "Stopping", "連線需要處理": "Connection needs attention", "啟動結果待確認": "Start status unconfirmed",
  "回看最近 100 段": "Recent 100 segments", "最近 5 組字幕": "Latest 5 caption pairs", "雙語即時閱讀": "Live bilingual view",
  "雙列即時閱讀": "Two-line live view", "捲動閱讀": "Scrollable view", "切換捲動閱讀": "Switch to scroll view", "切換固定閱讀": "Switch to fixed view",
  "回到雙語即時": "Back to live view", "查看歷史字幕": "View history", "回到最新字幕": "Back to latest",
  "謝謝參與，這場對話已結束。": "Thank you for joining. This conversation has ended.",
  "字幕已連線，等候下一句發言": "Connected. Waiting for the next speaker.",
  "準備好了，請開始說話": "Ready. Start speaking.", "等候主持人開啟對話": "Waiting for the host to start", "等待即時字幕": "Waiting for live captions",
  "你可以關閉此頁面，或等待下一場活動的邀請。": "You can close this page or wait for an invitation to the next event.",
  "原文與譯文將隨著發言，逐句出現在這裡。": "Original speech and translations will appear here as you speak.",
  "按下 Quick Start 後，原文與翻譯會顯示在這裡。": "Select Quick Start to display speech and translations here.",
  "字幕只在本次連線顯示": "Captions from this connection only", "不錄音 · 不錄影": "No audio or video recording",
  "本次連線 · 第 {first}–{last} 段": "This connection · Segments {first}–{last}", "（顯示最近 100 段）": " (latest 100 shown)",
  "正在加入這場對話。": "Joining the conversation…", "連接中": "Connecting", "原文與翻譯 · 即時同步": "Original + translation · In sync",
  "純字幕，不開啟麥克風": "Captions only · No microphone", "重新連線": "Reconnect", "正在尋找你的活動…": "Finding your event…",
  "這場對話已告一段落，謝謝你的參與。": "This conversation has ended. Thank you for joining.",
  "加入後的字幕會即時出現，這個頁面不保存過往字幕。": "Captions appear after you join. This page does not store past captions.",
  "正在連接活動": "Connecting to event", "連線未完成": "Connection incomplete", "尚未連線": "Not connected", "已連線": "Connected",
  "重新連線中": "Reconnecting", "字幕連線中斷": "Caption connection lost", "字幕重新連線中": "Reconnecting captions", "字幕連線中斷，正在重試；請確認網路後等待幾秒。": "Caption connection interrupted; retrying. Check your network and wait a few seconds.", "音訊重新連線中": "Reconnecting audio",
  "版面資訊": "Layout info", "視窗": "Window", "可見": "Visible", "縮放": "Scale", "偏移": "Offset", "頁框": "Frame", "容器": "Container", "螢幕": "Screen",
  "相容閱讀": "Compatibility view", "標準閱讀": "Standard view", "旋轉後若被裁切，可切換為可捲動的閱讀版面": "If rotation clips the page, switch to a scrollable reading layout",
  "一場跨越語言的對話": "A conversation across languages",
  "準備連線": "Preparing connection", "連接麥克風": "Connecting microphone", "啟動即時翻譯": "Starting live translation",
  "停止翻譯": "Stopping translation", "查詢服務": "Checking service", "尚未開始": "Not started", "活動已進行時間": "Event elapsed time",
  "進階設定": "Advanced settings", "停止": "Stop", "建立新活動": "New event", "關閉提示": "Dismiss notice",
  "服務尚未設定完成": "Service setup incomplete", "請設定 .env.local 中的 {fields}。": "Configure {fields} in .env.local.", "重新檢查": "Check again",
  "音訊來源": "Audio source", "麥克風": "Microphone", "電腦／分頁音訊": "Computer / tab audio", "開始後選擇播放音訊的分頁並勾選分享音訊。系統／OBS 音訊支援依瀏覽器與作業系統而定。": "Choose the playing browser tab and enable Share audio. System/OBS audio support depends on your browser and OS.",
  "麥克風音量": "Microphone volume", "麥克風已靜音": "Microphone muted", "正在聆聽與翻譯": "Listening and translating", "等待音訊輸入": "Waiting for audio",
  "恢復麥克風": "Unmute microphone", "靜音麥克風": "Mute microphone", "麥克風裝置": "Microphone device", "系統預設麥克風": "System default microphone",
  "重新整理麥克風裝置": "Refresh microphones", "活動名稱": "Event name", "輸入活動名稱": "Enter event name", "翻譯方向": "Translation direction",
  "展示控制碼": "Demo access code", "輸入展示控制碼": "Enter demo access code", "查詢服務狀態": "Check service status",
  "不錄音・不錄影・中文繁體呈現": "No recording · Traditional Chinese captions",
  "掃碼加入，在自己的裝置同步查看原文與翻譯。": "Scan to follow speech and translations on your device.",
  "等待 HTTPS 分享入口": "Waiting for HTTPS sharing", "開始後顯示 QR Code": "QR code appears after starting",
  "HTTPS 分享已就緒": "HTTPS sharing ready", "手機分享尚未啟用": "Mobile sharing unavailable",
  "已複製觀眾連結": "Audience link copied", "複製手機連結": "Copy mobile link", "開啟觀眾頁": "Open audience page",
  "啟用公開 HTTPS 連線後，這裡會自動產生手機可用的 QR Code。": "Enable public HTTPS sharing to generate a mobile QR code here.",
  "檢查分享連線": "Check sharing", "手機、平板、電腦": "Phone, tablet, desktop", "原文與譯文同步": "Speech and translation in sync",
  "不需註冊或開啟麥克風": "No signup or microphone needed", "顯示模式": "Display mode", "字幕模式": "Subtitle mode",
  "即時字幕": "Live captions", "退出全螢幕": "Exit fullscreen", "退出全螢幕（Esc）": "Exit fullscreen (Esc)", "放大字幕視窗": "Expand captions",
  "請按 Esc 離開全螢幕。": "Press Esc to exit fullscreen.",
  "文字自動保存在本機瀏覽器": "Transcript saved automatically in this browser", "保存需處理": "Save needs attention", "保存中": "Saving",
  "{count} 段已保存": "{count} segments saved", "下載字幕": "Download transcript", "保存與下載字幕": "Save & download transcript",
  "字幕下載設定": "Transcript download settings", "關閉下載設定": "Close download settings", "僅保存在這台瀏覽器，不含錄音。": "Stored only in this browser. No audio recording.",
  "選擇活動": "Select event", "選擇保存活動": "Select saved event", "尚無保存字幕": "No saved transcript", "{title} · {count} 段": "{title} · {count} segments",
  "下載格式": "Download format", "字幕下載格式": "Transcript format", "{count} 段文字已保存，最近保存 {time}": "{count} segments saved. Last saved at {time}",
  "開始活動後，收到的字幕會自動保存。": "Received captions are saved automatically after starting an event.",
  "含活動經過時間與台北時間。時間依字幕首次接收近似；斷線或關頁期間無法補收。": "Includes elapsed and Taipei time, estimated from first receipt. Captions missed while offline or with the page closed cannot be recovered.",
  "重試保存": "Retry save", "下載 {format} TXT": "Download {format} TXT", "已產生 {count} 段{format} TXT。": "Created {format} TXT with {count} segments.",
  "無法讀取服務狀態，請重新整理頁面。": "Unable to read service status. Refresh the page.",
  "麥克風需要 HTTPS 或 localhost，請從安全網址開啟。": "The microphone requires HTTPS or localhost. Open a secure URL.",
  "無法開始翻譯，請確認麥克風與服務設定。": "Unable to start. Check microphone permissions and service settings.",
  "停止尚未完成，請再次嘗試。": "Stop not yet confirmed. Please try again.", "查詢失敗。": "Status check failed.",
  "尚無可查詢的 Agent ID，請在 Agora 服務後台核對這場活動；不要重複建立。": "No known Agent ID. Check this event in the Agora console before creating another agent.",
  "服務查詢結果：{status}": "Service status: {status}", "請先停止目前活動，再建立新活動。": "Stop the current event before creating another.",
  "文字尚未保存成功，請先下載或重試保存，再建立新活動。": "Transcript not saved yet. Download or retry saving before creating a new event.",
  "無法自動複製，請使用下方觀眾網址。": "Unable to copy. Use the audience URL below.", "麥克風控制失敗，請重試。": "Microphone control failed. Try again.",
  "無法讀取麥克風裝置，請確認瀏覽器權限。": "Unable to list microphones. Check browser permissions.", "此瀏覽器不支援電腦音源分享，請使用最新版 Chrome 或 Edge。": "This browser does not support computer audio sharing. Use the latest Chrome or Edge.", "沒有取得分頁或螢幕音訊，請在分享視窗勾選「分享音訊」後重試。": "No tab or screen audio was captured. Enable Share audio in the picker and try again.",
  "無法加入活動。": "Unable to join the event.", "尚無已保存的字幕可下載。": "No saved captions to download.", "暫時無法下載，請重試。": "Unable to download. Try again.",
  "無法開啟本機文字資料庫，請確認不是限制儲存的瀏覽模式。": "Unable to open local transcript storage. Check browser storage restrictions.",
  "文字尚未保存成功，可能是儲存空間不足。請保留此頁面並按重試保存。": "Transcript not saved, possibly due to insufficient storage. Keep this page open and retry saving.",
  "這個瀏覽器不支援本機文字保存，請改用一般模式的 Chrome 或 Safari。": "This browser does not support local transcript storage. Use Chrome or Safari in normal mode.",
  "文字資料庫被其他舊分頁占用，請關閉舊分頁後重試。": "Another old tab is blocking transcript storage. Close it and try again.",
  "文字儲存未完成": "Transcript save incomplete", "文字儲存失敗": "Transcript save failed",
  "連線憑證更新暫時失敗，15 秒後會重試。": "Token renewal failed temporarily. Retrying in 15 seconds.", "連線已取消。": "Connection cancelled.",
  "字幕訂閱未恢復，請按重新連線。": "Caption subscription was not restored. Select Reconnect.",
  "連線身分已變更，請重新整理頁面後再開始。": "Connection identity changed. Refresh the page before starting again.",
  "電腦音源已停止": "Computer audio stopped", "電腦／分頁音訊已停止，請重新選擇音訊來源並按重新連線。": "Computer/tab audio stopped. Select an audio source and reconnect.",
  "上一個字幕連線仍在使用中，請稍後重試。": "The previous caption connection is still in use. Try again shortly.",
  "展示控制碼不正確。": "Incorrect demo access code.", "請選擇中英翻譯方向。": "Select a Chinese/English translation direction.",
  "請輸入 1～80 字的活動名稱。": "Enter an event name between 1 and 80 characters.", "無法執行清理。": "Cleanup is not permitted.",
  "觀眾不能申請服務 Bot 身分。": "Viewers cannot request a service bot identity.", "另一個操作正在處理，請稍後再試。": "Another operation is in progress. Try again shortly.",
  "操作狀態尚未確認，請查詢活動後再試。": "Operation status is unconfirmed. Check the event before retrying.", "雲端部署需要設定活動狀態儲存。": "Configure event storage before deploying to the cloud.",
  "請先完成本機環境設定，再開始活動。": "Complete local setup before starting an event.", "App ID 格式不正確，請檢查環境設定。": "Invalid App ID format. Check environment settings.",
  "請使用文件列出的 Agora API 區域網址。": "Use an Agora API regional URL listed in the documentation.", "Token Builder 請使用不含 query 或憑證的 HTTPS 網址。": "Use a Token Builder HTTPS URL without query parameters or credentials.",
  "請使用 JSON 請求。": "Send a JSON request.", "請求內容過大。": "Request is too large.", "請求格式不正確。": "Invalid request format.",
  "找不到這場活動。": "Event not found.", "找不到這場活動，請確認分享網址。": "Event not found. Check the shared URL.", "請從活動網站操作。": "Use the event website for this operation.",
  "暫時無法完成操作，請稍後再試。": "Unable to complete the operation. Try again shortly.", "暫時無法完成操作。": "Unable to complete the operation.",
  "暫時無法取得連線憑證，請稍後再試。": "Unable to obtain a connection token. Try again shortly.", "Token 服務未成功回應（HTTP {status}）。": "Token service failed (HTTP {status}).",
  "Token 服務回應格式不正確。": "Invalid token service response.", "Token 服務未提供預期憑證，請確認使用目前的 Builder。": "Token service did not return the expected token. Check the builder version.",
  "Builder Token 與本機 App ID 不一致，請確認使用同一個 Agora Project。": "Builder token and local App ID do not match. Use the same Agora project.",
  "啟動結果尚未確認。請勿重複啟動，先在服務後台核對這場活動。": "Start result unconfirmed. Check the event in the service console before retrying.",
  "翻譯啟動結果待核對（HTTP {status}），請勿重複啟動。": "Translation start unconfirmed (HTTP {status}). Do not start again yet.",
  "翻譯服務拒絕啟動（HTTP {status}），請檢查 Project、REST 憑證與服務開通設定。": "Translation start rejected (HTTP {status}). Check the project, REST credentials and service activation.",
  "啟動回應不完整，請先核對服務後台。": "Incomplete start response. Check the service console first.", "服務未回傳 Agent 識別，請先核對後台。": "No Agent ID returned. Check the service console first.",
  "尚未確認翻譯服務已停止，請保留活動並重試停止。": "Translation stop is unconfirmed. Keep the event and retry stopping.", "停止尚未成功（HTTP {status}），請稍後重試。": "Stop failed (HTTP {status}). Try again shortly.",
  "暫時無法查詢翻譯狀態。": "Unable to check translation status.", "翻譯狀態查詢未成功。": "Translation status check failed.",
  "這個操作需要主持人控制權。": "This operation requires host access.", "活動已到期，請建立新活動。": "Event expired. Create a new event.",
  "這個展示環境的活動數已達上限，請先清理舊活動。": "Event limit reached. Clean up old events first.", "這場活動已結束。": "This event has ended.",
  "這場展示活動已達觀眾上限。": "Audience limit reached for this demo event.", "活動的 Agent 狀態不完整，請先核對服務。": "Agent status is incomplete. Check the service first.",
  "翻譯服務已結束，請建立新活動。": "Translation service has ended. Create a new event.", "翻譯服務尚未就緒，請查詢狀態後再連線。": "Translation service is not ready. Check status before reconnecting.",
  "請先確認或停止既有翻譯。已結束的活動需重新建立。": "Confirm or stop the existing translation first. Ended events must be recreated.",
  "啟動狀態待核對，請先查詢服務。": "Start status unconfirmed. Check the service first.",
  "Agent 建立結果未知，請先核對服務後台；系統不會假裝已停止。": "Agent creation result is unknown. Check the service console; stop has not been confirmed.",
  "停止尚未成功，請重試。": "Stop failed. Try again.",

};

const dynamicMessages = Object.entries(EN).filter(([source]) => source.includes("{")).map(([source, english]) => {
  const keys: string[] = [];
  const pattern = source.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { keys.push(part.slice(1, -1)); return "(.+?)"; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { pattern: new RegExp(`^${pattern}$`), keys, english };
});
export function translate(locale: Locale, text: string, params: Params = {}): string {
  let value = locale === "en" ? EN[text] || text : text;
  let resolved = params;
  if (locale === "en" && !EN[text]) {
    for (const template of dynamicMessages) {
      const match = template.pattern.exec(text);
      if (match) { value = template.english; resolved = Object.fromEntries(template.keys.map((key, i) => [key, match[i + 1]])); break; }
    }
  }
  return value.replace(/\{(\w+)\}/g, (match, key: string) => resolved[key] === undefined ? match : String(resolved[key]));
}

/** Legacy events store the built-in title as literal text. Localize only the
 * two known defaults; an event title supplied by the user stays verbatim. */
export function localizedEventTitle(title: string, locale: Locale) {
  const source = "一場跨越語言的對話";
  return title === source || title === EN[source] ? translate(locale, source) : title;
}

/** Caption placeholders follow the pane language, independently of UI locale. */
export function captionHint(language: string, state: "waiting" | "recognizing" | "translating" | "updating") {
  const english = language.startsWith("en");
  return {
    waiting: english ? "Waiting for the next speaker" : "等候下一句發言",
    recognizing: english ? "Recognizing…" : "辨識中…",
    translating: english ? "Translating, please wait" : "翻譯中，請稍候",
    updating: english ? "Translation updating" : "翻譯更新中",
  }[state];
}

export function localizedUrl(url: string, locale: Locale) {
  if (!url) return url;
  const parsed = new URL(url, "https://local.invalid");
  parsed.searchParams.set("lang", locale);
  return /^https?:\/\//.test(url) ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
