# GitHub → Vercel 部署指南

[English](deployment.en.md) · [README](../README.md)

## 1. 先準備要公開的副本

截圖中的 **Import Project → Import** 是正確入口。這個流程先從 GitHub 取得原始碼；不想用 GitHub 也能使用 Vercel CLI，但建議用 GitHub 管理你的作品與更新。

在目前專案資料夾執行：

```bash
npm ci
npm test
npm run typecheck
npm run check:public
npm run prepare:public
```

工具會輸出 `.release/lingua-live/`。這是準備推上 GitHub 的副本，不含 `.env.local`、本機活動資料、Tunnel 狀態、建置、工具或私有筆記。不要改用 Finder 上傳整個原始工作資料夾。


工具會拒絕覆蓋已存在的公開副本。下次重新整理版本前，先將舊副本移到別處並保留其 Git repository，再產生新副本；不要刪除含未推送提交的資料夾。

本機原資料夾保留執行設定；公開副本只有空白 `.env.example`。MIT 已納入，允許他人保留作者聲明後重用與客製化。

## 2. 建立 GitHub repository

建議第一次設 **Private**。Vercel 可以匯入你授權的 Private repository；等雲端測試通過後，再將作品改為 Public。

### 方法 A：GitHub Desktop（適合首次操作）

1. 從 [GitHub Desktop 官方網站](https://desktop.github.com/) 安裝並登入 GitHub。
2. 選 **File → Add Local Repository**，指定 `.release/lingua-live`。
3. 若提示尚未是 Git repository，選 **Create a repository here**。名稱使用 `lingua-live`，路徑保持這份公開副本；不要建立到含 `.env.local` 的原工作目錄。
4. 在 Changes 檢查待提交清單：只能是 `src/`、`tests/`、`scripts/`、公開 `docs/`、README、MIT、設定範本與 package 檔案。
5. 若出現 `.env.local`、`.data`、`.tools`、`.next*` 或 `docs/local`，先停止，不提交。
6. Summary 填入 `Initial public-ready release`，按 **Commit to main**。
7. 按 **Publish repository**，名稱 `lingua-live`，第一次勾選 **Keep this code private**。
8. 開啟 GitHub 頁面檢查 README、英文連結、來源與 LICENSE。

### 方法 B：Terminal

這部 Mac 先前的 `/usr/bin/git` 回報 Xcode 授權尚未完成；這屬本機工具前置，並非程式錯誤。請由你在 Terminal 執行 `sudo xcodebuild -license` 並親自閱讀／同意，或使用你已安裝且可用的 Git。代理不會代你接受條款。

先在 GitHub 選 **New repository**，名稱 `lingua-live`、Private；不要讓 GitHub 另外生成 README、LICENSE 或 .gitignore。再進入公開副本：

```bash
cd .release/lingua-live

git init -b main
git add .gitignore .nvmrc .env.example AGENTS.md LICENSE README.md README.en.md package.json package-lock.json tsconfig.json next.config.ts src tests scripts docs
git diff --cached --name-only
```

確認只有公開檔案後：

```bash
git commit -m "Initial public-ready release"
git remote add origin https://github.com/YOUR_ACCOUNT/lingua-live.git
git push -u origin main
```

將 `YOUR_ACCOUNT` 換成你的 GitHub 帳號。認證使用 GitHub Desktop、Git Credential Manager 或 GitHub 提示的安全方式，不把個人存取 Token 寫在 remote URL。

推送原始碼不等於部署。GitHub repository 本身不能以 GitHub Pages 執行這個 Next.js 後端。

## 3. 建立 Upstash Redis

1. 到 [Upstash Console](https://console.upstash.com/) 建立 Redis database；或在 Vercel 的 **Storage／Marketplace** 尋找 Upstash Redis。
2. 名稱可用 `lingua-live-production`。區域盡量接近 Vercel Function 與使用者。
3. 從該 database 取得 **REST URL** 與 **REST Token**，不要用一般 TCP Redis URL 代替。
4. 保留在自己的平台設定頁，稍後填入 Vercel，不貼到 GitHub、README 或對話。

Redis 只存活動控制狀態；字幕 TXT 仍在主持人瀏覽器。免費額度、區域與使用限制以平台當時顯示為準。Preview 測試若共用 Redis，使用不同 `REDIS_KEY_PREFIX`，避免和 Production 活動混用。

## 4. 匯入 Vercel

1. 在截圖畫面按 **Import**，連接 GitHub，只授權需要的 repository。
2. 選 `lingua-live` → **Import**。
3. **Framework Preset** 選 **Next.js**。
4. **Root Directory** 使用 repository 根目錄（`./`）。如果你選擇自行上傳 monorepo，才改成含 `package.json` 的子目錄。
5. **Node.js Version** 選 **22.x**。
6. Install Command 使用 `npm ci`，Build Command 使用 `npm run build`；Output Directory 保留 Next.js 預設。
7. 不設定 `NEXT_BUILD_DIR`；本機的 `.next-viewer-*` 不用上傳或配置。

Vercel 方案應依目前官方計畫條款與額度選擇。個人作品測試與正式客戶商業部署應分別評估；不要假設 Hobby 免費方案可承載任何客戶用途。

## 5. 設定環境變數

在 Vercel **Settings → Environment Variables** 設定下列欄位。初次以 **Production** 為主；若啟用 Preview，使用獨立設定／Redis prefix。所有欄位都不要加 `NEXT_PUBLIC_`。

| 名稱 | 內容 | Production |
| --- | --- | --- |
| `AGORA_APP_ID` | 自己 Agora Project 的 App ID | 必填 |
| `AGORA_CUSTOMER_ID` | 該帳號 REST Customer ID | 必填 |
| `AGORA_CUSTOMER_SECRET` | REST Customer Secret | 必填 |
| `TOKEN_BUILDER_URL` | 自己 Worker 的 HTTPS 根網址，無 query／憑證 | 必填 |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL | 必填 |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST Token | 必填 |
| `DEMO_ACCESS_CODE` | 自己產生、供主持人建立活動的控制碼 | 必填 |
| `CLEANUP_SECRET` | 與控制碼不同的隨機 Secret | 必填 |
| `SITE_URL` | 最終穩定 Production HTTPS origin | 部署後補上再 Redeploy |
| `REDIS_KEY_PREFIX` | 例如 `lingua-live-production`；Preview 使用別的名稱 | 建議 |
| `AGORA_API_BASE_URL` | 預設 `https://api.agora.io`，需符合 Project 區域 | 選填 |
| `AGORA_V2V_PRESET` | 預設 `v2vt_base`，依服務開通契約 | 選填 |
| `TOKEN_BUILDER_API_KEY` | 僅在自己的 Worker 已支援 Bearer 驗證時使用 | 選填 |

App Certificate 留在你自己的 Token Builder；這個網站不需要它。不要重用作者的帳號、Worker 或員工憑證。公開 demo 的控制碼是簡單主持操作保護，不是會員系統，也不是完整企業限流方案。

## 6. 第一次部署與固定網址

1. 可先不填 `SITE_URL`，按 **Deploy** 取得 Vercel 分配的 Production 網址。此時介面可載入，但會顯示設定未完成並禁止開始。
2. 複製穩定網址，例如 `https://lingua-live-example.vercel.app`。不要用某一次 build 的臨時 URL，也不要放活動路徑。
3. 在 Production Environment Variables 加入 `SITE_URL`。
4. 選 **Redeploy**。環境變數修改不會自動更新既有部署。
5. 開啟 `/api/setup`，確認 `ready: true`、`storage: "redis"`、`local: false`、`shareBaseUrl` 是正式網址；不應顯示任何 Secret 值。
6. 若掃碼者被要求登入 Vercel，檢查 Production 的 Deployment Protection。觀眾網址必須可讓預定的外部觀眾存取；Preview 可繼續保護。

Vercel 部署完成後，手機網址不再依賴你的電腦開機，也不再需要 `3000／3001／3002` 或 Cloudflare Tunnel。主持人仍需開著瀏覽器播放／發送音訊。

## 7. 上線驗收

1. 電腦開正式網址，輸入 demo 控制碼。
2. 麥克風中翻英／英翻中各說幾句，確認原文、譯文與繁體中文。
3. 另測 YouTube 分頁音訊，勾選分享音訊；確認音量表與字幕。
4. 掃工作室 QR Code，確認手機可加入且不要求收音。
5. 手機接收超過 5 組：上滑閱讀，確認新句不搶走目前畫面；按「回到最新字幕」恢復。
6. 停止分享 → 重新選音源 → 重新連線，確認舊字幕在收到新字幕後仍保留。
7. 停止活動，確認狀態變為已結束；下載三種 TXT。
8. 重新整理同一瀏覽器，確認本機保存仍可下載。`localhost` 的舊逐字稿不會自動出現在新的 Vercel 網址，請先下載備份。
9. 在 Vercel Logs 查控制 API 錯誤，在 Upstash 檢查用量；不要把含 Token 或認證的完整網路請求貼到公開 issue。

現有 automated tests 不等於已完成真實 Vercel／Redis 雲端驗收。至少完成上述流程後再分享給客戶。

## 8. 清理與後續更新

`POST /api/cleanup` 需要 `Authorization: Bearer <CLEANUP_SECRET>`。它只重試待停止／過期非 RUNNING 活動，不會因時間而切斷 RUNNING；每次最多 3 筆。專案沒有配置自動排程，設定 Secret 不等於清理會自行執行。Vercel Cron 通常呼叫 GET，本專案只提供 POST，不要直接指向而以為已接好；需要自行配置支援 POST 的排程，或日後新增經驗證的 Cron adapter。

正式離開前請按停止；瀏覽器關頁不保證執行雲端 leave。Agent 有自己的 idle 行為，但不是主持人按停止的替代。大量客戶活動還需調整展示數量限制、儲存分片、持有者恢復與限流。

後續在你建立的 Git repository 修改並 push `main`，Vercel 會自動部署 Production；Pull Request 可產生 Preview。若繼續從原本本機資料夾整理更新，重新產生公開副本後，只同步白名單原始碼／文件，保留副本的 `.git`，不要將本機 `.env.local` 複製進去。

## 官方參考

- [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Storage](https://vercel.com/docs/storage)
- [Upstash Redis 入門](https://upstash.com/docs/redis/overall/getstarted)
- [GitHub：加入本機原始碼](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
