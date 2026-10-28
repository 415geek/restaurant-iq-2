"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export function CopyLink({ url }: { url: string }) {
  const { t } = useI18n(); const [ok, setOk] = useState(false);
  return <Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* clipboard blocked: the link is visible to copy by hand */ } }}>{ok ? t("pass.copied") : t("pass.copy")}</Button>;
}
