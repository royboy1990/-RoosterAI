import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientCanvas } from "@/app/_components/ambient-canvas";
import { RoosterFmDock } from "@/app/_components/rooster-fm-dock";
import { RoosterFMProvider } from "@/app/_components/rooster-fm-provider";
import { SiteHeader } from "@/app/_components/site-header";
import { TimezoneBootstrap } from "@/app/_components/timezone-bootstrap";
import {
  WakeProvider,
  WakeResultBanner,
} from "@/app/_components/wake-provider";
import { MascotCompanion } from "@/app/_components/mascot/mascot-companion";
import { MascotProvider } from "@/app/_components/mascot/mascot-provider";
import { PreferencesSaveProvider } from "@/app/_components/preferences-save-context";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { readLatestBrief } from "@/src/core/store";
import { loadHeaderWeather } from "@/src/core/weather";
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
  const loaded = await loadConfig({ rootDir });
  const timezone = loaded.config.timezone;
  const now = new Date();
  const weather = await loadHeaderWeather({
    weatherLocation: loaded.config.weatherLocation,
    timezone,
    now,
  });

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <RoosterFMProvider>
          <WakeProvider wakeSound={loaded.config.wakeSound}>
            <MascotProvider>
              <PreferencesSaveProvider>
                <AmbientCanvas />
                <TimezoneBootstrap timezone={timezone} />
                <SiteHeader
                  status={latest?.status ?? null}
                  timezone={timezone}
                  now={now}
                  weather={weather}
                />
                <WakeResultBanner />
                <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col px-6 py-8 pb-28">
                  {children}
                </div>
                <MascotCompanion />
                <RoosterFmDock />
              </PreferencesSaveProvider>
            </MascotProvider>
          </WakeProvider>
        </RoosterFMProvider>
      </body>
    </html>
  );
}
