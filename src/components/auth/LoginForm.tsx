"use client";
import { useState } from "react";
import { getBrowserClient } from "@/lib/db/browser";
import { Button } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) { setState("error"); setMsg(error.message); return; }
    setState("sent");
  }
  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">We email you a one-time link. No password. Private workspaces are isolated per organization with row-level security.</p>
      <label className="mt-5 block text-sm font-medium" htmlFor="email">Email</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-base" placeholder="you@restaurant.com" />
      <Button type="submit" className="mt-4 w-full" disabled={state === "sending" || state === "sent"}>{state === "sending" ? "Sending…" : state === "sent" ? "Check your email" : "Email me a sign-in link"}</Button>
      {state === "sent" ? <p className="mt-3 text-sm text-good">Link sent. Open it on this device to continue.</p> : null}
      {state === "error" ? <p className="mt-3 text-sm text-bad" role="alert">{msg}</p> : null}
      <p className="mt-5 text-xs text-muted">Just judging? The <a className="underline" href="/demo">demo workspace</a> needs no account.</p>
    </form>
  );
}
