// Vercel Routing Middleware: only people with a price-check login can open the private
// price-check page and its API. Every other path on the site is untouched.
import { checkLogin, loginRequired, parseUsers } from "./lib/price-check-auth.js";

export const config = { matcher: ["/price-check", "/price-check/:path*", "/api/price-check"] };

export default function middleware(request) {
  const raw = process.env.PRICE_CHECK_USERS;
  if (!checkLogin(request, raw)) return loginRequired(parseUsers(raw).size > 0);
  // Let the request continue (what `next()` from @vercel/functions returns).
  return new Response(null, { headers: { "x-middleware-next": "1" } });
}
