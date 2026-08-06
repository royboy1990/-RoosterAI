import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/app/_components/site-header";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { readLatestBrief } from "@/src/core/store";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RoosterAI",
  description: "Self-hosted morning briefing agent. Wake the Flock Up.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rootDir = resolveRootDir();
  const latest = await readLatestBrief(rootDir);

  let timezone = "UTC";
  try {
    const loaded = await loadConfig({ rootDir });
    timezone = loaded.config.timezone;
  } catch {
    // Config may be missing on first clone — header still renders.
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader
          status={latest?.status ?? null}
          timezone={timezone}
          now={new Date()}
        />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
