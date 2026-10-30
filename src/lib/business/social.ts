/**
 * Social copy for a TastePass: deterministic templates per platform and language.
 * The numbers, dates and link come from the stored campaign, never from a model; a model may later
 * rephrase a draft but never changes price, cap, dates or the claim URL (not wired in this build).
 */
export type Platform = "instagram" | "facebook" | "xiaohongshu" | "wechat" | "nextdoor";
export type PostLang = "en" | "zh" | "es";
export const PLATFORMS: Platform[] = ["instagram", "facebook", "xiaohongshu", "wechat", "nextdoor"];
export const PLATFORM_DEFAULT_LANG: Record<Platform, PostLang> = { instagram: "en", facebook: "en", nextdoor: "en", xiaohongshu: "zh", wechat: "zh" };
export const PLATFORM_LIMIT: Record<Platform, number> = { instagram: 2200, facebook: 5000, xiaohongshu: 1000, wechat: 2000, nextdoor: 1500 };

export interface SocialInput {
  restaurant: { name: string; neighborhood?: string | null; city?: string | null; cuisine: string };
  offer: { name: string; menuItem: string; offerPrice: number; regularPrice: number; endsAt: string; maxRedemptions: number };
  moment?: { name: string; date: string } | null;
  url: string;
}
export interface SocialPost { platform: Platform; lang: PostLang; text: string; hashtags: string[]; shareHref: string | null; limit: number }

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(n % 1 === 0 ? 0 : 2)}`;
const fmtDate = (iso: string, lang: PostLang) => {
  const loc = lang === "zh" ? "zh-CN" : lang === "es" ? "es-US" : "en-US";
  return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(loc, { month: "short", day: "numeric", timeZone: iso.length === 10 ? "UTC" : "America/Los_Angeles" });
};
const tag = (s: string) => s.replace(/\([^)]*\)/g, "").replace(/[^\p{L}\p{N}]+/gu, "");

export function hashtagsFor(input: SocialInput, lang: PostLang): string[] {
  const { restaurant: r } = input; const place = r.neighborhood || r.city || ""; const cuisine = r.cuisine.split(/[\/,·]/)[0].trim();
  const base = lang === "zh"
    ? [place ? `${tag(place)}美食` : "", r.city ? `${tag(r.city)}美食` : "", "湾区美食", `${tag(cuisine)}`, tag(r.name)]
    : lang === "es"
      ? [place ? `${tag(place)}Eats` : "", r.city ? `${tag(r.city)}Food` : "", `Comida${tag(cuisine)}`, "BayAreaEats", tag(r.name)]
      : [place ? `${tag(place)}Eats` : "", r.city ? `${tag(r.city)}Food` : "", `${tag(cuisine)}Food`, "BayAreaEats", tag(r.name)];
  return Array.from(new Set(base.filter(Boolean))).slice(0, 5).map((x) => `#${x}`);
}

type Vars = { name: string; item: string; price: string; was: string; until: string; cap: string; place: string; url: string; moment: string; mdate: string };
const vars = (input: SocialInput, lang: PostLang): Vars => ({
  name: input.restaurant.name, item: input.offer.menuItem, price: money(input.offer.offerPrice), was: money(input.offer.regularPrice),
  until: fmtDate(input.offer.endsAt, lang), cap: String(input.offer.maxRedemptions), place: input.restaurant.neighborhood || input.restaurant.city || "",
  url: input.url, moment: input.moment?.name ?? "", mdate: input.moment ? fmtDate(input.moment.date, lang) : "",
});

/* Templates. {moment_line} is dropped when the pass is not timed to a moment. */
const T: Record<PostLang, Record<Platform, { moment: string; body: string }>> = {
  en: {
    instagram: { moment: "{moment} is on {mdate}. We made a plan for it.\n\n", body: "{moment_line}{item} for {price} (usually {was}) at {name}, {place}.\n\nTap the link in bio or scan the code at the door, get your pass, show it at the counter. {cap} passes only, until {until}.\n\n{url}" },
    facebook: { moment: "{moment} ({mdate}) is coming up, so here is something for the neighborhood: ", body: "{moment_line}{item} for {price} instead of {was} at {name} in {place}.\n\nGet your pass here: {url}\nShow the code at the counter. First {cap} passes, valid until {until}." },
    nextdoor: { moment: "Neighbors: {moment} is on {mdate}. ", body: "{moment_line}{name} on {place} is running a small neighborhood special: {item} for {price} (regular {was}).\n\nClaim a pass at {url} and show the code when you order. {cap} passes, until {until}. Thanks for supporting a local kitchen." },
    xiaohongshu: { moment: "{moment}（{mdate}）快到了，我们准备了一个小活动：", body: "{moment_line}{place} 的 {name}，{item} 只要 {price}（原价 {was}）。\n\n点链接领券，到店出示码就行。限 {cap} 张，{until} 截止。\n\n{url}" },
    wechat: { moment: "{moment}（{mdate}）将至，", body: "{moment_line}{name}（{place}）本周特惠：{item} {price}，原价 {was}。\n\n领券链接：{url}\n到店出示券码即可使用。限 {cap} 张，有效期至 {until}。欢迎转发给朋友。" },
  },
  zh: {
    instagram: { moment: "{moment}（{mdate}）就要到了，我们为它准备了一个方案。\n\n", body: "{moment_line}{place} 的 {name}：{item} 只要 {price}（平时 {was}）。\n\n点主页链接或在门口扫码领券，到店出示即可。限 {cap} 张，{until} 截止。\n\n{url}" },
    facebook: { moment: "{moment}（{mdate}）快到了，给街坊的一点心意：", body: "{moment_line}{name}（{place}）{item} {price}，原价 {was}。\n\n领券：{url}\n到店出示券码。限前 {cap} 位，有效期至 {until}。" },
    nextdoor: { moment: "各位邻居：{moment} 在 {mdate}。", body: "{moment_line}{place} 的 {name} 推出一个小小的街坊特惠：{item} {price}（原价 {was}）。\n\n到 {url} 领券，点单时出示券码。限 {cap} 张，{until} 截止。谢谢支持本地小店。" },
    xiaohongshu: { moment: "{moment}（{mdate}）快到了，我们准备了一个小活动：", body: "{moment_line}{place} 的 {name}，{item} 只要 {price}（原价 {was}）。\n\n点链接领券，到店出示码就行。限 {cap} 张，{until} 截止。\n\n{url}" },
    wechat: { moment: "{moment}（{mdate}）将至，", body: "{moment_line}{name}（{place}）本周特惠：{item} {price}，原价 {was}。\n\n领券链接：{url}\n到店出示券码即可使用。限 {cap} 张，有效期至 {until}。欢迎转发给朋友。" },
  },
  es: {
    instagram: { moment: "{moment} es el {mdate}. Preparamos algo para ese día.\n\n", body: "{moment_line}{item} por {price} (normalmente {was}) en {name}, {place}.\n\nToca el enlace en la bio o escanea el código en la puerta, consigue tu pase y muéstralo en caja. Solo {cap} pases, hasta el {until}.\n\n{url}" },
    facebook: { moment: "Se acerca {moment} ({mdate}), así que aquí va algo para el barrio: ", body: "{moment_line}{item} por {price} en vez de {was} en {name}, {place}.\n\nConsigue tu pase aquí: {url}\nMuestra el código en caja. Primeros {cap} pases, válido hasta el {until}." },
    nextdoor: { moment: "Vecinos: {moment} es el {mdate}. ", body: "{moment_line}{name} en {place} tiene una pequeña oferta para el barrio: {item} por {price} (precio normal {was}).\n\nReclama tu pase en {url} y muestra el código al ordenar. {cap} pases, hasta el {until}. Gracias por apoyar una cocina local." },
    xiaohongshu: { moment: "{moment}（{mdate}）快到了，我们准备了一个小活动：", body: "{moment_line}{place} 的 {name}，{item} 只要 {price}（原价 {was}）。\n\n点链接领券，到店出示码就行。限 {cap} 张，{until} 截止。\n\n{url}" },
    wechat: { moment: "{moment}（{mdate}）将至，", body: "{moment_line}{name}（{place}）本周特惠：{item} {price}，原价 {was}。\n\n领券链接：{url}\n到店出示券码即可使用。限 {cap} 张，有效期至 {until}。欢迎转发给朋友。" },
  },
};

function fill(tpl: string, v: Record<string, string>): string { return tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? ""); }

export function shareHref(platform: Platform, text: string, url: string): string | null {
  if (platform === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
  return null; // Instagram, Xiaohongshu, WeChat and Nextdoor have no web prefill; the owner pastes the copy.
}

export function buildSocialPost(platform: Platform, lang: PostLang, input: SocialInput): SocialPost {
  const v = vars(input, lang); const tpl = T[lang][platform];
  const moment_line = input.moment ? fill(tpl.moment, v) : "";
  const hashtags = hashtagsFor(input, platform === "xiaohongshu" || platform === "wechat" ? "zh" : lang);
  let text = fill(tpl.body, { ...v, moment_line }).replace(/[ \t]+\n/g, "\n").trim();
  if (platform !== "wechat") text = `${text}\n\n${hashtags.join(" ")}`;
  const limit = PLATFORM_LIMIT[platform];
  if (text.length > limit) text = `${text.slice(0, limit - 1)}…`;
  return { platform, lang, text, hashtags, shareHref: shareHref(platform, text, input.url), limit };
}

export function buildSocialPosts(input: SocialInput, langs: Partial<Record<Platform, PostLang>> = {}): SocialPost[] {
  return PLATFORMS.map((p) => buildSocialPost(p, langs[p] ?? PLATFORM_DEFAULT_LANG[p], input));
}
