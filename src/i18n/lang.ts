// The site's one language system (Thai / English) for every public page.
//
// - Thai is the default and the pre-rendered language.
// - A visitor's explicit choice is saved under "balena-lang" (the key the earlier home page
//   used), so it carries across pages, refreshes and tabs.
// - Each page's <head> runs LANG_BOOT_SCRIPT first: for a saved English choice it hides the
//   page until React has switched to English, so the Thai pre-render never flashes.
//   useDocumentLang() reveals it again.
import { useEffect, useSyncExternalStore } from "react";

export type Lang = "th" | "en";
export const LANGS: Lang[] = ["th", "en"];
export const LANG_KEY = "balena-lang";

/** A string in both languages. */
export type T = { th: string; en: string };

const listeners = new Set<() => void>();
let current: Lang | null = null;

function read(): Lang {
  if (current) return current;
  try {
    current = localStorage.getItem(LANG_KEY) === "en" ? "en" : "th";
  } catch {
    current = "th"; // storage blocked: Thai
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LANG_KEY) return;
    current = null;
    listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

/** The visitor's language. Thai while pre-rendering and hydrating, then the saved choice. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "th");
}

/** An explicit choice from the TH / EN switch: applied everywhere and remembered. */
export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Not saved; the choice still applies for this visit.
  }
  listeners.forEach((l) => l());
}

const setMeta = (selector: string, value: string) => document.querySelector(selector)?.setAttribute("content", value);

/** Keeps <html lang>, the title and the description/social tags in the page's language. */
export function useDocumentLang(lang: Lang, meta: { title: string; description: string }) {
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    document.title = meta.title;
    setMeta('meta[name="description"]', meta.description);
    setMeta('meta[property="og:title"]', meta.title);
    setMeta('meta[property="og:description"]', meta.description);
    setMeta('meta[property="og:locale"]', lang === "en" ? "en_US" : "th_TH");
    // Reveal once the page shows the saved language (see LANG_BOOT_SCRIPT).
    if (lang === read()) html.classList.remove("lang-pending");
  }, [lang, meta.title, meta.description]);
}

/**
 * Inline <head> script (scripts/prerender.mjs adds it to every public page). Kept tiny and
 * dependency-free; the 1.5 s timer reveals the page even if the app fails to start.
 */
export const LANG_BOOT_SCRIPT =
  `<script>try{if(localStorage.getItem("${LANG_KEY}")==="en"){var d=document.documentElement;d.lang="en";` +
  `d.classList.add("lang-pending");setTimeout(function(){d.classList.remove("lang-pending")},1500)}}catch(e){}</script>` +
  `<style>.lang-pending body{visibility:hidden}</style>`;
