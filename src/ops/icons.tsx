// One line-icon family for the operations app (24 × 24, 1.8 stroke, round caps). Decorative only:
// every icon sits next to a text label.
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  cart: <path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h8.3a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /></>,
  box: <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3zM3 7.5 12 12l9-4.5M12 12v9" />,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>,
  alert: <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17v.01" /></>,
  chart: <path d="M5 20V11M12 20V5M19 20v-6M3 20h18" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  print: <><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2" /><rect x="6" y="14" width="12" height="7" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  count: <path d="M9 4h6v3H9zM6 6h2M16 6h2M6 6v14h12V6M9 12l2 2 4-4" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  replay: <path d="M4 4v6h6M20 12a8 8 0 0 1-14.6 4.5M4 10a8 8 0 0 1 14.6-4.5" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  check: <path d="M4 12l5 5L20 6" />,
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
