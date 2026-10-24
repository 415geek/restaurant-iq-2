import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Restaurant IQ — Taste-to-Profit Agent", template: "%s · Restaurant IQ" },
  description: "Your POS runs your restaurant. Restaurant IQ grows your business. Qloo taste intelligence turned into testable, costed restaurant opportunities with a decision memory.",
  openGraph: { title: "Restaurant IQ — Taste-to-Profit Agent", description: "Cross-domain taste intelligence → ranked, costed restaurant hypotheses → execution playbooks → decision memory.", type: "website" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f6f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
