// Serves dist/ the way vercel.json tells Vercel to: static files first, then the
// redirects and rewrites. Lets the page check exercise the real routing locally.
// Usage: node scripts/serve-dist.mjs [port]
import { createServer } from "node:http";
import { readFileSync, statSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] ?? 4173);
const root = "dist";
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain" };

const toRegex = (source) =>
  new RegExp(`^${source.replace(/:path\*/g, ".*").replace(/:([a-z]+)/g, "(?<$1>[^/]+)")}$`);
// Like Vercel: fill :params into the destination and keep the request's query string.
const redirectTarget = (r, path, search) => {
  const groups = toRegex(r.source).exec(path)?.groups ?? {};
  const dest = new URL(r.destination.replace(/:([a-z]+)/g, (_, k) => groups[k] ?? ""), "http://x");
  new URLSearchParams(search).forEach((v, k) => { if (!dest.searchParams.has(k)) dest.searchParams.append(k, v); });
  return dest.pathname + dest.search;
};
const fileFor = (p) => {
  const full = normalize(join(root, decodeURIComponent(p)));
  if (!full.startsWith(root)) return null;
  if (existsSync(full) && statSync(full).isFile()) return full;
  const index = join(full, "index.html");
  return p.endsWith("/") && existsSync(index) ? index : null;
};

// With PRICE_CHECK_USERS set, also run the real middleware.js login check and
// api/price-check.js against an in-memory stand-in for Upstash Redis (local testing only).
const emulate = Boolean(process.env.PRICE_CHECK_USERS);
let middleware = null, api = null;
const fakeRedis = new Map();
if (emulate) {
  process.env.KV_REST_API_URL ||= `http://localhost:${port}/__fake-redis`;
  process.env.KV_REST_API_TOKEN ||= "local";
  middleware = await import(new URL("../middleware.js", import.meta.url));
  api = await import(new URL("../api/price-check.js", import.meta.url));
}
const toRequest = async (req) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
};
const send = async (res, response) => {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
};
const matches = (path) => middleware?.config.matcher.some((m) => toRegex(m).test(path));

createServer(async (req, res) => {
  const { pathname: path, search } = new URL(req.url, "http://x");
  if (emulate && path === "/__fake-redis") {
    const [cmd, key, field, value] = JSON.parse((await toRequest(req).then((r) => r.text())) || "[]");
    if (cmd === "HSET") fakeRedis.set(field, value);
    const result = cmd === "HGETALL" ? [...fakeRedis].flat() : 1;
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ result }));
  }
  if (emulate && matches(path)) {
    const request = await toRequest(req);
    const verdict = await middleware.default(request);
    if (!verdict.headers.get("x-middleware-next")) return send(res, verdict);
    if (path === "/api/price-check") {
      const handler = api[req.method];
      return send(res, handler ? await handler(request) : new Response("Method not allowed", { status: 405 }));
    }
  }
  let file = fileFor(path);
  if (!file) {
    const redirect = config.redirects?.find((r) => toRegex(r.source).test(path));
    if (redirect) {
      res.writeHead(redirect.permanent ? 308 : 307, { Location: redirectTarget(redirect, path, search) });
      return res.end();
    }
    const rewrite = config.rewrites?.find((r) => toRegex(r.source).test(path));
    if (rewrite) file = fileFor(rewrite.destination);
  }
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("404");
  }
  res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`dist/ on http://localhost:${port}`));
