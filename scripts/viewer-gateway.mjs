import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function viewerRoute(method, pathname, body) {
  if (["GET", "HEAD"].includes(method)) {
    if (/^\/event\/[a-f0-9]{24}$/.test(pathname)) return "page";
    if (/^\/api\/events\/[a-f0-9]{24}$/.test(pathname)) return "status";
    if (pathname.startsWith("/_next/static/") && !pathname.endsWith(".map")) return "asset";
    if (pathname === "/favicon.ico") return "asset";
  }
  if (method === "POST" && /^\/api\/events\/[a-f0-9]{24}\/tokens$/.test(pathname)) {
    if (body && typeof body === "object" && !Array.isArray(body) && (body.role === undefined || body.role === "viewer") && Object.keys(body).every((key) => key === "role")) return "token";
  }
  return null;
}

export function createViewerGateway({ upstream, healthKey, getPublicUrl }) {
  const target = new URL(upstream);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.protocol !== "http:") throw new Error("Gateway upstream must be local HTTP.");
  const rates = new Map();
  return http.createServer(async (request, response) => {
    const deny = (status, text) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify({ error: text })); };
    try {
      const url = new URL(request.url || "/", "http://gateway.local");
      if (url.pathname === "/__health") {
        const supplied = request.headers.authorization || "";
        const expected = `Bearer ${healthKey}`;
        if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return deny(403, "Viewer access only");
        response.writeHead(204); response.end(); return;
      }
      let body;
      if (request.method === "POST") {
        let text = "";
        for await (const chunk of request) {
          text += chunk.toString();
          if (text.length > 1024) return deny(413, "Request too large");
        }
        try { body = JSON.parse(text); } catch { return deny(400, "JSON required"); }
      }
      const route = viewerRoute(request.method, url.pathname, body);
      if (!route) return deny(403, "此網址僅供觀眾查看字幕；主持人請使用本機工作室。");
      const publicUrl = getPublicUrl();
      if (request.headers.origin && (!publicUrl || request.headers.origin !== new URL(publicUrl).origin)) return deny(403, "Origin rejected");
      if (route === "token") {
        const now = Date.now();
        for (const [key, value] of rates) if (now > value.until) rates.delete(key);
        if (rates.size > 10000) return deny(429, "Please retry later");
        const ip = request.headers["cf-connecting-ip"] || request.socket.remoteAddress;
        const entry = rates.get(ip) || { count: 0, until: now + 60000 };
        entry.count++; rates.set(ip, entry);
        if (entry.count > 30) return deny(429, "Please retry later");
      }
      const proxyUrl = new URL(url.pathname + url.search, target);
      const headers = {
        Host: target.host,
        ...(request.headers.accept ? { Accept: request.headers.accept } : {}),
        ...(request.headers["accept-language"] ? { "Accept-Language": request.headers["accept-language"] } : {}),
      };
      if (route === "token") {
        headers["Content-Type"] = "application/json";
        headers.Origin = target.origin;
        if (/^Bearer [a-f0-9]{64}$/.test(request.headers.authorization || "")) headers.Authorization = request.headers.authorization;
      }
      const result = await fetch(proxyUrl, { method: request.method, headers, ...(route === "token" ? { body: JSON.stringify({ role: "viewer" }) } : {}), redirect: "manual", signal: AbortSignal.timeout(25000) });
      const outHeaders = { "Content-Type": result.headers.get("Content-Type") || "application/octet-stream", "Cache-Control": route === "asset" ? "public, max-age=3600" : "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Permissions-Policy": "microphone=(), camera=()" };
      response.writeHead(result.status, outHeaders);
      response.end(request.method === "HEAD" ? undefined : Buffer.from(await result.arrayBuffer()));
    } catch { if (!response.headersSent) deny(502, "觀眾入口暫時無法連線，請稍後再試。"); else response.end(); }
  });
}

async function main() {
  const port = Number(process.env.VIEWER_PORT || 3001);
  const healthKey = randomBytes(32).toString("hex");
  const configPath = path.join(process.cwd(), ".data", "public-viewer.json");
  const executable = process.env.CLOUDFLARED_BIN || (existsSync(".tools/cloudflared") ? path.resolve(".tools/cloudflared") : "cloudflared");
  let publicUrl = "";
  const upstream = process.env.VIEWER_UPSTREAM || "http://127.0.0.1:3002";
  // Share a production build. Next dev's HMR bootstrap is not proxied by this
  // intentionally narrow gateway and can prevent browser hydration.
  try {
    const ready = await fetch(`${upstream}/api/setup`, { signal: AbortSignal.timeout(5000) });
    if (!ready.ok) throw new Error();
  } catch { throw new Error("Start the production viewer server on port 3002 first."); }
  const gateway = createViewerGateway({ upstream, healthKey, getPublicUrl: () => publicUrl });
  await new Promise((resolve, reject) => { gateway.once("error", reject); gateway.listen(port, "127.0.0.1", resolve); });
  console.log(`Viewer-only gateway listening on 127.0.0.1:${port}.`);
  const tunnel = spawn(executable, ["--no-autoupdate", "tunnel", "--url", `http://127.0.0.1:${port}`, "--protocol", "http2"], { stdio: ["ignore", "pipe", "pipe"] });
  let exiting = false;
  const shutdown = async () => {
    if (exiting) return; exiting = true;
    tunnel.kill("SIGTERM"); gateway.closeAllConnections(); gateway.close();
    try { const saved = JSON.parse(await readFile(configPath, "utf8")); if (saved.healthKey === healthKey) await rm(configPath); } catch {}
  };
  const output = async (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !publicUrl) {
      publicUrl = match[0];
      await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
      await writeFile(configPath, JSON.stringify({ url: publicUrl, port, healthKey, createdAt: Date.now() }), { mode: 0o600 });
      console.log(`Public viewer URL: ${publicUrl}`);
      console.log("The studio QR code will update automatically. Keep this process running; Ctrl+C closes sharing.");
    }
    if (/ERR|Registered tunnel connection/.test(text)) console.log(text.replace(/\s+/g, " ").trim());
  };
  tunnel.stdout.on("data", (chunk) => { void output(chunk); });
  tunnel.stderr.on("data", (chunk) => { void output(chunk); });
  tunnel.on("error", async () => { console.error("cloudflared could not start. Install the official Cloudflare binary first."); await shutdown(); process.exitCode = 1; });
  tunnel.on("exit", async () => { await shutdown(); });
  process.on("SIGINT", () => { void shutdown(); });
  process.on("SIGTERM", () => { void shutdown(); });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("Could not start the viewer gateway. Check the local app and port."); process.exitCode = 1; });
}
