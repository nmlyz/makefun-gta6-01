import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(repoRoot, "game");
const shotsDir = path.join(repoRoot, "screenshots");
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const envUrl = process.env.MAKEFUN_ENV_URL;

const mimeByExt: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff2": "font/woff2",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function copyTree(srcDir: string, dstDir: string): void {
  mkdirSync(dstDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const fromPath = path.join(srcDir, entry.name);
    const toPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(fromPath, toPath);
    } else if (entry.isFile()) {
      copyFileSync(fromPath, toPath);
    }
  }
}

function applyPerms(dirPath: string): void {
  chmodSync(dirPath, 0o755);
  const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const target = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      applyPerms(target);
    } else if (entry.isFile()) {
      chmodSync(target, 0o644);
    }
  }
}

function buildOutputs(): void {
  mkdirSync(outDir, { recursive: true });
  if (existsSync(gameDir)) {
    copyTree(gameDir, path.join(outDir, "game"));
  }
  if (existsSync(shotsDir)) {
    copyTree(shotsDir, path.join(outDir, "screenshots"));
  }
  const dossierText = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(path.join(outDir, "dossier.json"), dossierText, "utf8");
  applyPerms(outDir);
}

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return mimeByExt[ext] ?? "application/octet-stream";
}

function serveGame(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse): void {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }
  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  if (pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  if (decoded === "/") {
    decoded = "/index.html";
  }
  const target = path.resolve(gameDir, `.${decoded}`);
  if (target !== gameDir && !target.startsWith(gameDir + path.sep)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  let info;
  try {
    info = statSync(target);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  if (!info.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  const body = readFileSync(target);
  res.writeHead(200, { "Content-Type": mimeFor(target) });
  res.end(body);
}

async function runServerMode(): Promise<void> {
  const base = (envUrl as string).replace(/\/+$/, "");
  const server = createServer((req, res) => {
    try {
      serveGame(req, res);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal Server Error");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;

  let registered = false;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const resp = await fetch(`${base}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port }),
      });
      if (resp.ok) {
        registered = true;
        break;
      }
      lastError = new Error(`register failed with status ${resp.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < 5) {
      await sleep(500);
    }
  }
  if (!registered) {
    console.error(
      lastError instanceof Error ? lastError.message : String(lastError),
    );
    server.close();
    process.exit(1);
  }

  for (;;) {
    try {
      const resp = await fetch(`${base}/done`);
      if (resp.ok) {
        break;
      }
    } catch {
      // fall through to retry
    }
    await sleep(500);
  }
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function main(): Promise<void> {
  try {
    buildOutputs();
    if (!envUrl) {
      console.log("done");
      return;
    }
    await runServerMode();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

void main();

// Stop signals should end the process promptly instead of leaving it
// hanging on a long poll or a listening socket.
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
