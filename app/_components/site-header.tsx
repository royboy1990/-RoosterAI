"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { copy } from "@/src/copy";
import type { CoopStatus } from "@/src/core/types";
import type { WeatherSnapshot } from "@/src/core/weather";
import {
  coopStatusClass,
  coopStatusLabel,
  formatHeaderTime,
} from "@/app/_lib/format";
import { HeaderPrimaryAction } from "@/app/_components/header-primary-action";
import {
  HeaderWeatherBackdrop,
  WeatherConditionIcon,
} from "@/app/_components/header-weather";

export function SiteHeader({
  status,
  timezone,
  now,
  weather = null,
}: {
  status: CoopStatus | null;
  timezone: string;
  now: Date | string;
  weather?: WeatherSnapshot | null;
}) {
  // Seed from the server render so hydration matches, then tick on the client.
  const [clock, setClock] = useState(() => new Date(now));

  useEffect(() => {
    const tick = () => setClock(new Date());
    tick();
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, []);

  const time = formatHeaderTime(clock, timezone);
  const hasWeather = weather !== null && weather !== undefined;

  return (
    <header
      className="relative sticky top-0 z-30 overflow-hidden border-b border-border"
      data-weather={hasWeather ? "1" : "0"}
    >
      <HeaderWeatherBackdrop weather={weather ?? null} />
      {/* Scrim: keep sky visible top-right; darken under brand/nav for contrast. */}
      {hasWeather ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/45 via-surface/72 to-surface/94"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/60 via-surface/30 to-transparent"
            aria-hidden
          />
        </>
      ) : null}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <Link
              href="/"
              className="site-header-brand flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-accent"
            >
              {/* Black plate on the PNG; screen blend lifts the bird on dark chrome. */}
              <img
                src="/rooster-mark.png"
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 object-contain mix-blend-screen"
                aria-hidden
              />
              <span>{copy.brand}</span>
            </Link>
            <p className="site-header-meta metric-mono min-w-0 text-xs text-muted">
              [{time}]
              {hasWeather ? (
                <>
                  {" · "}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <WeatherConditionIcon
                      condition={weather.condition}
                      isDay={weather.isDay}
                      tempC={weather.tempC}
                    />
                    <span>{weather.tempC}</span>
                  </span>
                </>
              ) : null}
              {" · "}
              {copy.coopStatus.label}:{" "}
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${coopStatusClass(status)}`}
              >
                {coopStatusLabel(status)}
              </span>
            </p>
          </div>
          <nav className="site-header-nav flex min-w-0 flex-wrap gap-4 text-sm text-muted">
            <Link href="/" className="hover:text-foreground">
              {copy.nav.latest}
            </Link>
            <Link href="/history" className="hover:text-foreground">
              {copy.nav.history}
            </Link>
            <Link href="/ask" className="hover:text-foreground">
              {copy.nav.ask}
            </Link>
            <Link href="/coop" className="hover:text-foreground">
              {copy.nav.coop}
            </Link>
            <Link href="/settings" className="hover:text-foreground">
              {copy.nav.settings}
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2 self-start sm:self-center">
          <HeaderPrimaryAction />
        </div>
      </div>
    </header>
  );
}
