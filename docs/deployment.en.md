# GitHub → Vercel Deployment

[繁體中文](deployment.zh-TW.md) · [README](../README.en.md)

## 1. Prepare the public copy

The Vercel **Import Project → Import** button imports a repository. GitHub is recommended for version control and automatic deployment; the Vercel CLI is an alternative.

```bash
npm ci
npm test
npm run typecheck
npm run check:public
npm run prepare:public
```

Publish the generated `.release/lingua-live/` copy, not the original workspace. The copy excludes credentials, local state, tools, build output, private notes and historical QA screenshots. It includes an empty `.env.example` and MIT license.


The tool refuses to overwrite an existing release copy. Move the old copy aside, preserving any Git repository and unpushed work, before generating another.

## 2. Create the GitHub repository

Start with a **Private** repository. Vercel can import an authorized private repository. Make it public after cloud acceptance testing.

### GitHub Desktop

1. Install [GitHub Desktop](https://desktop.github.com/) and sign in.
2. Choose **File → Add Local Repository**, select `.release/lingua-live`, and choose **Create a repository here** if needed.
3. Name it `lingua-live`, keeping the location of the clean copy.
4. Review Changes: source, tests, scripts, public docs, READMEs, license and configuration templates only. Stop if local environment/state/tool/build files appear.
5. Commit as `Initial public-ready release`.
6. Select **Publish repository**, keeping the code private initially.
7. Verify the rendered READMEs, links, sources and license on GitHub.

### Terminal

On the original author's Mac, Apple's Git reported an unaccepted Xcode license. The user must personally review/accept it with `sudo xcodebuild -license`, or use another installed Git. No license agreement is accepted by the preparation scripts.

Create an empty private `lingua-live` repository on GitHub without generated files, then:

```bash
cd .release/lingua-live
git init -b main
git add .gitignore .nvmrc .env.example AGENTS.md LICENSE README.md README.en.md package.json package-lock.json tsconfig.json next.config.ts src tests scripts docs
git diff --cached --name-only
# Inspect the staged paths before continuing.
git commit -m "Initial public-ready release"
git remote add origin https://github.com/YOUR_ACCOUNT/lingua-live.git
git push -u origin main
```

Replace `YOUR_ACCOUNT`. Use secure GitHub authentication; do not embed tokens in the remote URL. GitHub Pages alone cannot run this backend.

## 3. Provision Redis

Create an Upstash Redis database in the [Upstash Console](https://console.upstash.com/) or through Vercel Storage/Marketplace. Obtain the **REST URL** and **REST Token**, not a TCP Redis connection URL. Keep them out of the repository. Choose a region near your Functions. Review current vendor quotas rather than assuming free hosting at every usage level.

Use a dedicated database or distinct `REDIS_KEY_PREFIX` values for Production and Preview. Redis stores event/control state, not full transcripts.

## 4. Import into Vercel

1. Import the GitHub repository, granting access to the required repository only.
2. Framework: **Next.js**. Root Directory: repository root (`./`).
3. Node.js: **22.x**. Install: `npm ci`. Build: `npm run build`.
4. Keep Next.js's default Output Directory. Do not set `NEXT_BUILD_DIR` in Vercel.
5. Select a plan based on current vendor terms, quotas, and whether this is a personal portfolio or a customer/commercial deployment.

## 5. Set environment variables

Set these in **Settings → Environment Variables**, primarily for Production. No secret may use a `NEXT_PUBLIC_` prefix.

| Name | Value | Production |
| --- | --- | --- |
| `AGORA_APP_ID` | Your project App ID | Required |
| `AGORA_CUSTOMER_ID` | REST Customer ID | Required |
| `AGORA_CUSTOMER_SECRET` | REST Customer Secret | Required |
| `TOKEN_BUILDER_URL` | Your HTTPS builder root URL, without query/auth | Required |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL | Required |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST Token | Required |
| `DEMO_ACCESS_CODE` | Your host creation access code | Required |
| `CLEANUP_SECRET` | Separate random cleanup secret | Required |
| `SITE_URL` | Stable Production HTTPS origin | Add after first deploy |
| `REDIS_KEY_PREFIX` | e.g. `lingua-live-production`; distinct for Preview | Recommended |
| `AGORA_API_BASE_URL` | Default `https://api.agora.io`; match project region | Optional |
| `AGORA_V2V_PRESET` | Default `v2vt_base`; match enabled service | Optional |
| `TOKEN_BUILDER_API_KEY` | Only if your builder already supports Bearer auth | Optional |

The App Certificate belongs in your Token Builder, not this website. Use your own service accounts and V2V access. The demo access code protects event creation but is not a full membership or enterprise abuse-control system.

## 6. Deploy and set the canonical URL

1. Deploy initially without `SITE_URL` to obtain your stable Production domain. The page can load, but starting remains disabled while setup is incomplete.
2. Add `SITE_URL=https://your-stable-project.vercel.app` to Production variables, without an event path or build-specific URL.
3. **Redeploy**: variable changes do not update existing deployments automatically.
4. Check `/api/setup`: `ready: true`, `storage: "redis"`, `local: false`, and the expected `shareBaseUrl`. No credentials should be returned.
5. If audience devices are asked to log into Vercel, review Production Deployment Protection for the intended audience. Preview can remain protected.

Once deployed, phones no longer depend on your computer's local services or tunnel. The host browser must still remain open to provide audio.

## 7. Acceptance checks

- Microphone Chinese→English and English→Chinese; verify Traditional Chinese output.
- YouTube tab with Share audio enabled; check the meter and captions.
- QR join from a phone without microphone permission.
- More than five pairs; scroll up, verify reading stays stable, then Back to latest.
- Stop share, choose another source and reconnect; old captions remain after new messages arrive.
- Stop event, confirm STOPPED, and download all three TXT formats.
- Refresh in the same origin/profile and verify saved host archives. Localhost archives do not migrate to the Vercel origin; export them first.
- Check Vercel errors and Upstash usage without publishing token-bearing requests or logs.

Automated tests are not a substitute for live Vercel/Redis acceptance testing.

## 8. Cleanup and updates

`POST /api/cleanup` requires `Authorization: Bearer <CLEANUP_SECRET>`. It retries stopping/expired non-RUNNING events, at most three per call. It never ends a RUNNING event merely due to elapsed time. No automatic schedule is configured. Vercel Cron normally sends GET, so do not point it at this POST-only route without a tested adapter; use a POST-capable scheduler or implement one separately.

Use Stop before leaving. Closing the host tab cannot guarantee a cloud leave call. Agent idle behavior is not a replacement for explicit stopping. Larger customer rollouts need capacity, rate-limit, storage and recovery design work.

Push subsequent changes to `main` to trigger Production deployment; PRs can create Preview deployments. If editing in the original workspace, regenerate the public copy and sync allowlisted sources/docs into your repository while preserving `.git` and excluding local credentials.

## Official references

- [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)
- [Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Storage](https://vercel.com/docs/storage)
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)
- [Adding local code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
