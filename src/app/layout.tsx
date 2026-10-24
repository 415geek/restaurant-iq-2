import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { getLocale, getDictionary } from "@/i18n";
import { I18nProvider } from "@/i18n/client";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"] });
const notoSC = Noto_Sans_SC({ variable: "--font-noto-sc", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: { default: "Restaurant IQ — Taste-to-Profit Agent", template: "%s · Restaurant IQ" },
  description: "Your POS runs your restaurant. Restaurant IQ grows your business. Qloo taste intelligence turned into three costed, testable ideas with a plan and a decision memory.",
  icons: { icon: "/brand/logo-mark.svg" },
  openGraph: { title: "Restaurant IQ — Taste-to-Profit Agent", description: "Cross-domain taste intelligence → three ideas worth testing → numbers → plan → memory.", type: "website" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFFFFF" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return (
    <html lang={locale === "zh" ? "zh-CN" : locale} className={`${jakarta.variable} ${notoSC.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} dict={dict}>{children}</I18nProvider>
      </body>
    </html>
  );
}
