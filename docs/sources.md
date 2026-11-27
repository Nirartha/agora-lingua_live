# Documentation Sources / 文檔來源

Checked / 整理日期：2026-11-27 (Asia/Taipei).

Links below identify reference material, not a claim that every vendor capability is enabled in this demo. 下列公開來源用於設計與實作參考，不代表本專案已實作文件中的所有能力。

| Source | Use in this project / 用途 |
| --- | --- |
| [Agora Web RTC quickstart](https://docs.agora.io/en/video-calling/get-started/get-started-sdk?platform=web) | Audio capture, join/publish lifecycle; 麥克風與 RTC 基本流程 |
| [Agora RTC Web package](https://www.npmjs.com/package/agora-rtc-sdk-ng) | Installed SDK API/types; Web SDK 版本與接口 |
| [Agora RTM package](https://www.npmjs.com/package/agora-rtm) | RTM login, subscription, token renewal and linkState; 字幕通道生命週期 |
| [Agora public real-time translation overview](https://docs.agora.io/en/realtime-media/speech-to-text/build/start-transcribing-and-translating/translation) | Product concepts only; 公開翻譯概念，不能直接取代本實作的 V2V 契約 |
| [Agora AccessToken2 Node.js builders](https://github.com/AgoraIO/Tools/tree/master/DynamicKey/AgoraDynamicKey/nodejs) | Token roles/services and signing reference; Token Builder 實作參考 |
| [Next.js server/client components](https://nextjs.org/docs/app/getting-started/server-and-client-components) | Server/client boundaries and UI providers |
| [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) | Node.js API routes |
| [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables) | Server-only configuration and public-variable boundaries |
| [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github) | Git deployments and repository import |
| [Vercel Environment Variables](https://vercel.com/docs/environment-variables) | Production/Preview configuration |
| [Vercel Storage](https://vercel.com/docs/storage) | Marketplace database provisioning |
| [Vercel Function limits](https://vercel.com/docs/functions/limitations) | Function execution model; no persistent media relay |
| [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) / [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines) | Review current plan eligibility and quotas before customer use |
| [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted) | Redis REST setup and serverless state |
| [GitHub local-code import](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github) | Initial repository/push workflow |
| [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) | User-gesture capture permissions and browser-specific audio support |
| [MDN MediaStreamTrack ended](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event) | Detect stopped browser sharing |
| [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Local transcript persistence |
| [OpenCC JS](https://github.com/nk2028/opencc-js) | Chinese display conversion |

## V2V integration provenance / 整合來源邊界

The translation adapter was developed against a separately enabled project-specific V2V contract supplied during integration. That contract, credentials, internal documentation pages, and example service data are **not reproduced** in the public package. Runtime source code expresses the adapter's implemented request/response handling; it is not a redistribution of the full vendor documentation.

本專案翻譯 adapter 依整合期間取得、需另行開通的 V2V 契約實作。公開交付不包含內部文件全文、內網連結、憑證或範例服務資料。公開 STT quickstart 與這個 V2V adapter 的接口／訊息格式可能不同；複製公開 STT 範例不能保證直接使用。請向 Agora 確認自己的服務權限、區域、preset 與契約後再接入。

No vendor approval of this independent project is implied. 這份來源清單不代表廠商對此作品的背書或商用服務保證。
