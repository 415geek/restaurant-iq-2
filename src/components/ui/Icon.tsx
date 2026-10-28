/** Tiny inline line-icon set (24px grid, 1.75 stroke). No emoji in product UI. */
import type { SVGProps } from "react";
function P(d: string) {
  function LineIcon(props: SVGProps<SVGSVGElement>) {
    return <svg viewBox="0 0 24 24" width={props.width ?? 18} height={props.height ?? 18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><path d={d} /></svg>;
  }
  return LineIcon;
}
export const Icon = {
  snapshot: P("M4 5h16v4H4zM4 11h16v8H4zM8 15h4"),
  signals: P("M3 20h18M6 16l4-5 4 3 4-7"),
  ideas: P("M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"),
  calendar: P("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"),
  ticket: P("M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2"),
  board: P("M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z"),
  memory: P("M12 8v4l3 2M21 12a9 9 0 1 1-9-9M21 3v6h-6"),
  leaf: P("M5 19C5 10 11 5 20 5c0 9-5 15-14 15M5 19c2-5 6-8 10-9"),
  cup: P("M6 5h11l-1 11a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3zM17 8h2a2 2 0 0 1 0 4h-2M9 2v2M13 2v2"),
  bowl: P("M4 12h16a8 8 0 0 1-16 0zM7 8l2-3M12 8l1-4M17 8l-1-3"),
  moon: P("M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"),
  group: P("M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M14 20a6 6 0 0 1 8 0"),
  sun: P("M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"),
  glass: P("M8 3h8l-1 8a3 3 0 0 1-6 0zM12 14v6M9 20h6"),
  link: P("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  truck: P("M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"),
  ban: P("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.5 5.5l13 13"),
  swap: P("M4 8h13l-3-3M20 16H7l3 3"),
  info: P("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01"),
  check: P("M5 12l4 4L19 7"),
  x: P("M6 6l12 12M18 6L6 18"),
  arrowRight: P("M5 12h14M13 6l6 6-6 6"),
  arrowLeft: P("M19 12H5M11 18l-6-6 6-6"),
  chevronDown: P("M6 9l6 6 6-6"),
  play: P("M8 5v14l11-7z"),
  refresh: P("M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"),
  pin: P("M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"),
  tag: P("M3 12V4h8l9 9-8 8zM7 8h.01"),
  user: P("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"),
  globe: P("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"),
  dollar: P("M12 2v20M17 6.5a4 4 0 0 0-4-2.5H11a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"),
  shield: P("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"),
  menu: P("M4 7h16M4 12h16M4 17h16"),
};
export type IconName = keyof typeof Icon;
export const HYP_ICON: Record<string, IconName> = { "weekday-lunch-set": "bowl", "vegetarian-line": "leaf", "boba-study-pairing": "cup", "late-night-window": "moon", "group-bundle": "group", "weekend-brunch": "sun", "bar-program": "glass", "cross-domain-partnership": "link", "delivery-virtual-brand": "truck" };
