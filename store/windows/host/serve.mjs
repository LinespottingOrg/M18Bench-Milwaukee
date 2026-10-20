import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const staticRoot = join(here, "static");
const port = Number(process.env.PORT || 39218);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

function staticFile(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relative = decoded.replace(/^\/+/, "");
  const file = normalize(join(staticRoot, relative));
  if (file !== staticRoot && !file.startsWith(staticRoot + sep)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

const handler = (await import(new URL("./functions/__server.func/index.mjs", import.meta.url))).default;

const server = createServer(async (req, res) => {
  try {
    const file = staticFile(req.url || "/");
    if (file) {
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] || "application/octet-stream",
        "cache-control": "no-cache",
      });
      createReadStream(file).pipe(res);
      return;
    }
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.from(await readBody(req));
    const request = new Request(new URL(req.url || "/", "http://127.0.0.1"), {
      method: req.method,
      headers: req.headers,
      body,
    });
    const response = await handler.fetch(request);
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.stack || error.message : "The bench did not start.");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`M18 Bench listening on ${port}\n`);
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
