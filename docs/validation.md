# Release Validation / 公開交付驗證

This release distinguishes code checks from live-service results. 本文件區分程式驗證、使用者實測與尚待驗收事項。

## Automated coverage

- Event host authorization, distinct viewer identities, token renewal identities and safe public state.
- Start checkpoints, duplicate Agent protection, uncertain join and failed-stop retry.
- Redis namespace isolation, lock ownership and refusal of local storage on Vercel. Redis behavior is tested through a deterministic fake, not a live Upstash account.
- RTM transient reconnect behavior, terminal recovery without double subscriptions, close during pending recovery, and same-UID takeover handling. SDK operations are faked; real network outages are not reproduced by these tests.
- Same-generation audio-source reselection reuses the transcript buffer; previous captions, corrections and sequence numbering survive the next incoming message.
- Chinese display conversion, fragmented RTM message assembly, revised ASR/translation snapshots and increasing row numbering.
- IndexedDB transcript persistence, correction replacement, failure retries, and synthetic 1–3 hour TXT exports beyond the 100-row rendered window.
- UI translations, caption-language placeholders, default/custom event titles, mobile window selection and viewport fallback calculations.
- Audience-only tunnel route boundaries, denied host controls and same-origin request checks.

Release preparation results: **58 automated tests passed**, TypeScript checks passed, and the production build completed. The generated source package contains no real service credentials or local runtime state. The public copy also passed a clean npm install (npm audit: zero reported vulnerabilities), all 58 tests, type checking and `VERCEL=1 npm run build` without `.env.local`. This validates packaging/build boundaries, not live cloud credentials or Upstash connectivity.

手機合成資料驗證：上滑後保留第 3–7 組；收到第 8 組時仍維持原閱讀內容與 scrollTop=0。按 Back to latest 才切至第 4–8 組並恢復跟隨。此驗證沒有連線 Agora 或擷取音訊。

Run `npm test`, `npm run typecheck`, `npm run build` and `npm run check:public`. The public preparation tool scans only the release allowlist, checks for local credential values without printing them, and refuses private files/internal URLs. It is a targeted release check, not a guarantee against every future secret pattern.

## User-confirmed behavior before release preparation

The user reported successful Chinese↔English captions, microphone input, YouTube audio sharing, phone QR reception, Traditional Chinese display and iPhone Safari portrait/landscape. One full YouTube test completed without RTM errors; other runs reported RTM socket interruptions. These reports are evidence of tested paths, not a network reliability guarantee.

## Production deployment status (2026-11-28)

The user completed deployment at [agora-lingua-live.vercel.app](https://agora-lingua-live.vercel.app/?lang=en). A read-only check confirmed the homepage returned HTTP 200 and `/api/setup` reported `ready: true`, `storage: "redis"`, `local: false`, host creation code enabled, and the expected Production origin. The readiness endpoint confirms required settings are present, not a successful Redis write or an end-to-end audio session. No microphone or Agent was started by that check.

## Remaining limits

- Production pages and configuration readiness have been checked. Real Redis writes, both-direction audio, QR reception and stopping on the deployed site still require the acceptance checks in the deployment guide.
- Agent token renewal beyond its 24-hour credential lifetime has not been validated. Browser one-hour renewal logic is tested, but a fresh multi-hour real cloud session has not been completed here.
- A specific Chrome iOS 18 combination clips in landscape while Safari on the same device is reported normal. No model-specific viewport patch is claimed as a verified fix.
- Screen/system audio varies by platform. Microphone, browser tab, application window and OBS virtual camera are not interchangeable audio sources.
- Transcript storage belongs to the host browser/origin. Changing to Vercel does not move existing localhost archives. No guarantee of backfilling missed RTM messages.
- No load test, enterprise rate limiting, account management, server transcript retention, AI summary or disaster recovery system is included.

The release does not create a real Agent automatically when tests or build run. `npm run smoke:live` is a separate opt-in integration check that creates a short-lived real Agent and attempts to stop it; it does not open a microphone.
