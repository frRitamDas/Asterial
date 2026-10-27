import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${ASTERIAL_BRAND.name} — ${ASTERIAL_BRAND.attribution}`,
    template: `%s · ${ASTERIAL_BRAND.name}`,
  },
  description: `${ASTERIAL_BRAND.tagline} Version ${ASTERIAL_BRAND.version} · Official Developer: ${ASTERIAL_BRAND.developer} (${ASTERIAL_BRAND.attribution}).`,
  applicationName: ASTERIAL_BRAND.name,
  authors: [{ name: ASTERIAL_BRAND.developer }],
  creator: `${ASTERIAL_BRAND.developer} (${ASTERIAL_BRAND.attribution})`,
};

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="obsidian"
      data-density="comfortable"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-[var(--bg-canvas)] font-sans text-[var(--text-primary)] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
