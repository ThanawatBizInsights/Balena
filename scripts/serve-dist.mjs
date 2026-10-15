// Serves dist/ the way vercel.json tells Vercel to: static files first, then the
// redirects and rewrites. Lets the page check exercise the real routing locally.
// Usage: node scripts/serve-dist.mjs [port]
import { createServer } from "node:http";
import { readFileSync, statSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] ?? 4173);
const root = "dist";
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

const toRegex = (source) => new RegExp(`^${source.replace(/:path\*/g, ".*")}$`);
const fileFor = (p) => {
  const full = normalize(join(root, decodeURIComponent(p)));
  if (!full.startsWith(root)) return null;
  if (existsSync(full) && statSync(full).isFile()) return full;
  const index = join(full, "index.html");
  return p.endsWith("/") && existsSync(index) ? index : null;
};

createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  let file = fileFor(path);
  if (!file) {
    const redirect = config.redirects?.find((r) => toRegex(r.source).test(path));
    if (redirect) {
      res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination });
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
