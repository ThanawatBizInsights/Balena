// Minimal client-side router for the trial pages. Every route lives under /trial, so trial
// navigation never reaches the live pages.
import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") window.addEventListener("popstate", notify);

export function usePath(): string {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => location.pathname.replace(/\/+$/, "") || "/",
    () => "/trial",
  );
}

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", to); else history.pushState(null, "", to);
  notify();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "instant" });
}

/** An in-app link: same-tab clicks route without a page load; other clicks behave normally. */
export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}

export function useTitle(title: string) {
  useEffect(() => { document.title = `${title} · Balena (ทดลอง)`; }, [title]);
}

export type Route =
  | { name: "home" }
  | { name: "order"; slug: string | null }
  | { name: "product"; slug: string }
  | { name: "cart" }
  | { name: "checkout" }
  | { name: "complete" }
  | { name: "notFound" };

export function matchRoute(path: string, search = ""): Route {
  if (path === "/trial") return { name: "home" };
  if (path === "/trial/order") return { name: "order", slug: new URLSearchParams(search).get("p") };
  const m = path.match(/^\/trial\/products\/([a-z0-9-]+)$/);
  if (m) return { name: "product", slug: m[1] };
  if (path === "/trial/cart") return { name: "cart" };
  if (path === "/trial/checkout") return { name: "checkout" };
  if (path === "/trial/complete") return { name: "complete" };
  return { name: "notFound" };
}
