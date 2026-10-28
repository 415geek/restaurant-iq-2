import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** Public origin of the current request (works behind Vercel and tunnels). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Inline SVG QR code, navy on white. Generated server-side, no client dependency. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1B2A4A", light: "#FFFFFF" } });
}
