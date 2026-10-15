// Shared storage for the private price-check page (/price-check/).
// GET returns every saved document; PUT {path, data} saves one.
// Data lives in one Redis hash (Upstash Redis from the Vercel Marketplace). Connecting it to
// the project sets KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
// The middleware already checked the login; this checks it again so the API is never open.
import { checkLogin } from "../lib/price-check-auth.js";

const KEY = "balena:price-check";
const validPath = (p) => p === "meta/settings" || p === "meta/todo" || /^items\/[a-z0-9-]{1,40}$/.test(String(p));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

function redis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (command) => {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(command) });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    return (await res.json()).result;
  };
}

export async function GET(request) {
  if (!checkLogin(request, process.env.PRICE_CHECK_USERS)) return json({ error: "login_required" }, 401);
  const call = redis();
  if (!call) return json({ error: "not_configured" }, 503);
  try {
    const flat = (await call(["HGETALL", KEY])) || [];
    const docs = {};
    for (let i = 0; i < flat.length; i += 2) {
      try { docs[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* skip a damaged entry */ }
    }
    return json({ docs });
  } catch {
    console.error("price-check: read failed");
    return json({ error: "unavailable" }, 502);
  }
}

export async function PUT(request) {
  const user = checkLogin(request, process.env.PRICE_CHECK_USERS);
  if (!user) return json({ error: "login_required" }, 401);
  const call = redis();
  if (!call) return json({ error: "not_configured" }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!validPath(body?.path) || typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
    return json({ error: "bad_request" }, 400);
  }
  const value = JSON.stringify({ ...body.data, _by: user, _at: new Date().toISOString() });
  if (value.length > 20000) return json({ error: "too_large" }, 413);
  try {
    await call(["HSET", KEY, body.path, value]);
    return json({ ok: true });
  } catch {
    console.error("price-check: write failed");
    return json({ error: "unavailable" }, 502);
  }
}
