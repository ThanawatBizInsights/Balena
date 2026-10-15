// Login check for the private price-check page and its API (HTTP Basic auth).
// Logins come from the PRICE_CHECK_USERS environment variable, set in Vercel:
//   PRICE_CHECK_USERS = "owner:long-password,partner:another-long-password"
// No variable means nobody gets in (fail closed).

export function parseUsers(raw) {
  const users = new Map();
  for (const entry of String(raw || "").split(",")) {
    const i = entry.indexOf(":");
    if (i > 0) users.set(entry.slice(0, i).trim(), entry.slice(i + 1).trim());
  }
  return users;
}

/** Compares without stopping at the first different character. */
function same(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Returns the signed-in username, or null. */
export function checkLogin(request, raw) {
  const users = parseUsers(raw);
  if (users.size === 0) return null;
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return null;
  let decoded;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return null;
  const name = decoded.slice(0, i), pass = decoded.slice(i + 1);
  const expected = users.get(name);
  return expected !== undefined && same(pass, expected) ? name : null;
}

export function loginRequired(configured) {
  return new Response(configured ? "Login required" : "This page is not set up yet (PRICE_CHECK_USERS is missing).", {
    status: configured ? 401 : 503,
    headers: {
      "WWW-Authenticate": 'Basic realm="Balena price check", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
