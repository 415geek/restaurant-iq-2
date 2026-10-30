"use client";
import { useMemo, useState } from "react";
import { Card, Chip, H2, cx } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { buildSocialPost, PLATFORMS, PLATFORM_DEFAULT_LANG, type Platform, type PostLang, type SocialInput } from "@/lib/business/social";

const LANGS: PostLang[] = ["en", "zh", "es"];
const LANG_LABEL: Record<PostLang, string> = { en: "EN", zh: "中文", es: "ES" };

/** Ready-to-paste copy per platform. Numbers and the link are read from the pass; the owner can only pick the platform and language. */
export function SocialPostCard({ input }: { input: SocialInput }) {
  const { t } = useI18n();
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [langs, setLangs] = useState<Partial<Record<Platform, PostLang>>>({});
  const [copied, setCopied] = useState(false);
  const lang = langs[platform] ?? PLATFORM_DEFAULT_LANG[platform];
  const post = useMemo(() => buildSocialPost(platform, lang, input), [platform, lang, input]);
  async function copy() {
    try { await navigator.clipboard.writeText(post.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the textarea is selectable */ }
  }
  return (
    <Card>
      <H2 hint={t("social.hint")}>{t("social.title")}</H2>
      <div role="tablist" aria-label={t("social.title")} className="flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => <button key={p} role="tab" aria-selected={p === platform} onClick={() => setPlatform(p)} className={cx("h-9 rounded-full border px-3 text-[13px] font-semibold", p === platform ? "border-coral bg-coral text-white" : "border-border bg-surface text-ink-2")}>{t(`social.platform.${p}`)}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="flex items-center gap-1.5"><span className="text-muted">{t("social.lang")}</span>{LANGS.map((l) => <button key={l} onClick={() => setLangs((s) => ({ ...s, [platform]: l }))} className={cx("rounded-full px-2.5 py-1 font-semibold", l === lang ? "bg-navy text-white" : "bg-surface-2 text-ink-2")}>{LANG_LABEL[l]}</button>)}</div>
        <Chip tone={post.text.length > post.limit * 0.9 ? "warn" : "neutral"}>{t("social.chars", { n: post.text.length, max: post.limit })}</Chip>
      </div>
      <textarea readOnly value={post.text} rows={9} data-testid="social-text" className="mt-3 w-full resize-y rounded-[var(--radius-ctl)] border border-border bg-surface p-3 text-[13.5px] leading-5" onFocus={(e) => e.currentTarget.select()} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-ctl)] bg-navy px-4 text-[14px] font-semibold text-white">{copied ? t("social.copied") : t("social.copy")}</button>
        {post.shareHref ? <a href={post.shareHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-[var(--radius-ctl)] border border-border px-4 text-[14px] font-semibold text-ink-2">{t("social.share")}</a> : null}
        <span className="text-[12px] text-muted">{t("social.qrHint")}</span>
      </div>
    </Card>
  );
}
