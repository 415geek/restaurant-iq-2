"use client";
import { useState } from "react";
import { getBrowserClient } from "@/lib/db/browser";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export function LoginForm({ next, expired }: { next: string; expired?: boolean }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState("sending");
    const { error } = await getBrowserClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) { setState("error"); setMsg(error.message); return; }
    setState("sent");
  }
  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">{t("login.title")}</h1>
      <p className="mt-1 text-[14px] text-ink-2">{t("login.body")}</p>
      {expired ? <p className="mt-3 text-[13px] text-bad" role="alert">{t("login.expired")}</p> : null}
      <label className="mt-5 block text-[13px] font-semibold" htmlFor="email">{t("login.email")}</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-12 w-full rounded-[var(--radius-ctl)] border border-border bg-surface px-3 text-base" placeholder="you@restaurant.com" />
      <Button type="submit" variant="coral" className="mt-4 w-full" disabled={state === "sending" || state === "sent"}>{state === "sending" ? t("login.sending") : state === "sent" ? t("login.sent") : t("login.send")}</Button>
      {state === "sent" ? <p className="mt-3 text-[13px] text-good-ink">{t("login.sentBody")}</p> : null}
      {state === "error" ? <p className="mt-3 text-[13px] text-bad" role="alert">{msg}</p> : null}
      <p className="mt-5 text-[12.5px] text-muted">{t("login.judge")} <a className="underline" href="/demo">{t("common.openDemo")}</a></p>
    </form>
  );
}
