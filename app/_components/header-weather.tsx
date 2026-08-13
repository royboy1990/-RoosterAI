"use client";

import { useEffect, useRef } from "react";
import {
  temperatureTintWash,
  weatherIconColor,
} from "@/src/core/weather";
import type { WeatherCondition, WeatherSnapshot } from "@/src/core/weather/types";

/**
 * Vivid animated weather layer for the site header (midnight Apple-Weather palette).
 * Renders nothing when snapshot is null so the header stays unchanged.
 */
export function HeaderWeatherBackdrop({
  weather,
}: {
  weather: WeatherSnapshot | null;
}) {
  if (!weather) {
    return null;
  }

  const { condition, isDay, tempC } = weather;
  const tone = backdropTone(condition, isDay);
  const tint = temperatureTintWash(tempC);

  return (
    <div
      className="header-weather pointer-events-none absolute inset-0 overflow-hidden"
      data-condition={condition}
      data-day={isDay ? "1" : "0"}
      aria-hidden
    >
      <div
        className="header-weather-gradient absolute inset-0"
        style={{ background: tone.gradient }}
      />
      {tone.bloom ? (
        <div
          className="header-weather-bloom absolute inset-0"
          style={{ background: tone.bloom }}
        />
      ) : null}
      {tint !== "transparent" ? (
        <div
          className="header-weather-temp-tint absolute inset-0"
          style={{ background: tint }}
        />
      ) : null}
      {condition === "clear" && isDay ? <SunBloom /> : null}
      {condition === "partlyCloudy" && isDay ? <SunBloom /> : null}
      {condition === "clear" && !isDay ? <NightSky /> : null}
      {condition === "partlyCloudy" && !isDay ? <NightSky /> : null}
      {PARALLAX_CLOUD_CONDITIONS.has(condition) ? <ParallaxClouds /> : null}
      {condition === "rain" || condition === "storm" ? (
        <HeaderRain storm={condition === "storm"} />
      ) : null}
      {condition === "snow" ? <SnowSpecks /> : null}
      {condition === "storm" ? <StormFlash /> : null}
    </div>
  );
}

/** Inline condition glyph for the header mono line (dock-style stroke icons). */
export function WeatherConditionIcon({
  condition,
  isDay,
  tempC,
  className = "size-3",
}: {
  condition: WeatherCondition;
  isDay: boolean;
  tempC: number;
  className?: string;
}) {
  const color = weatherIconColor(condition, isDay, tempC);

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      style={{ color }}
      aria-hidden
    >
      {condition === "clear" && isDay ? <SunPaths /> : null}
      {condition === "clear" && !isDay ? <MoonPaths /> : null}
      {condition === "partlyCloudy" && isDay ? <SunCloudPaths /> : null}
      {condition === "partlyCloudy" && !isDay ? <MoonCloudPaths /> : null}
      {condition === "cloudy" ? <CloudPaths /> : null}
      {condition === "rain" ? <CloudRainPaths /> : null}
      {condition === "snow" ? <SnowflakePaths /> : null}
      {condition === "storm" ? <LightningPaths /> : null}
      {condition === "fog" ? <FogPaths /> : null}
    </svg>
  );
}

function backdropTone(
  condition: WeatherCondition,
  isDay: boolean,
): { gradient: string; bloom: string | null } {
  if (condition === "storm") {
    return {
      gradient:
        "linear-gradient(165deg, rgba(28,34,52,0.95) 0%, rgba(22,26,38,0.7) 42%, rgba(18,18,18,0.25) 100%)",
      bloom:
        "radial-gradient(ellipse 48% 55% at 78% 0%, rgba(120,140,200,0.28) 0%, transparent 68%)",
    };
  }
  if (condition === "rain") {
    return {
      gradient:
        "linear-gradient(170deg, rgba(32,42,58,0.92) 0%, rgba(24,30,42,0.65) 45%, rgba(18,18,18,0.22) 100%)",
      bloom:
        "radial-gradient(ellipse 52% 50% at 85% 5%, rgba(70,110,160,0.32) 0%, transparent 70%)",
    };
  }
  if (condition === "snow") {
    return {
      gradient:
        "linear-gradient(175deg, rgba(58,64,76,0.88) 0%, rgba(36,40,50,0.58) 48%, rgba(18,18,18,0.2) 100%)",
      bloom:
        "radial-gradient(ellipse 55% 55% at 80% 0%, rgba(180,190,210,0.28) 0%, transparent 72%)",
    };
  }
  if (condition === "fog") {
    return {
      gradient:
        "linear-gradient(180deg, rgba(72,72,70,0.82) 0%, rgba(42,42,40,0.55) 50%, rgba(18,18,18,0.22) 100%)",
      bloom:
        "radial-gradient(ellipse 70% 45% at 50% 15%, rgba(160,160,156,0.22) 0%, transparent 75%)",
    };
  }
  if (condition === "cloudy") {
    return {
      gradient: isDay
        ? "linear-gradient(165deg, rgba(48,56,72,0.9) 0%, rgba(32,36,48,0.6) 48%, rgba(18,18,18,0.2) 100%)"
        : "linear-gradient(165deg, rgba(28,34,48,0.94) 0%, rgba(22,26,36,0.65) 48%, rgba(18,18,18,0.22) 100%)",
      bloom: isDay
        ? "radial-gradient(ellipse 55% 50% at 82% 0%, rgba(120,140,170,0.3) 0%, transparent 70%)"
        : "radial-gradient(ellipse 50% 48% at 80% 5%, rgba(90,110,150,0.28) 0%, transparent 70%)",
    };
  }
  if (condition === "partlyCloudy") {
    return {
      gradient: isDay
        ? "linear-gradient(155deg, rgba(72,50,22,0.88) 0%, rgba(40,34,24,0.55) 45%, rgba(18,18,18,0.18) 100%)"
        : "linear-gradient(168deg, rgba(24,30,52,0.94) 0%, rgba(20,24,40,0.62) 48%, rgba(18,18,18,0.22) 100%)",
      bloom: isDay
        ? "radial-gradient(ellipse 58% 72% at 90% 0%, rgba(240,160,48,0.5) 0%, rgba(240,140,40,0.22) 32%, transparent 68%)"
        : "radial-gradient(ellipse 48% 55% at 84% 8%, rgba(200,210,230,0.28) 0%, rgba(100,120,180,0.14) 38%, transparent 70%)",
    };
  }
  // clear
  if (isDay) {
    return {
      gradient:
        "linear-gradient(155deg, rgba(78,48,18,0.88) 0%, rgba(42,30,16,0.55) 42%, rgba(18,18,18,0.18) 100%)",
      bloom:
        "radial-gradient(ellipse 58% 72% at 90% 0%, rgba(240,160,48,0.62) 0%, rgba(240,140,40,0.28) 32%, transparent 68%)",
    };
  }
  return {
    gradient:
      "linear-gradient(170deg, rgba(22,30,62,0.95) 0%, rgba(18,24,44,0.65) 45%, rgba(18,18,18,0.22) 100%)",
    bloom:
      "radial-gradient(ellipse 48% 58% at 84% 8%, rgba(210,218,235,0.38) 0%, rgba(100,120,180,0.18) 38%, transparent 70%)",
  };
}

function SunBloom() {
  return (
    <div className="header-weather-sun absolute -right-4 -top-10 size-36 sm:-right-2 sm:-top-8 sm:size-44">
      <div className="header-weather-sun-core absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(240,160,48,0.55)] blur-[2px] sm:size-16" />
      <div className="header-weather-sun-rays absolute inset-0 opacity-90" />
    </div>
  );
}

function NightSky() {
  return (
    <>
      <div className="header-weather-moon absolute right-7 top-2 size-11 rounded-full bg-[rgba(220,224,232,0.42)] shadow-[0_0_28px_rgba(200,210,230,0.25)] sm:right-10 sm:top-3 sm:size-12" />
      <span className="header-weather-star absolute left-[12%] top-3 size-1 rounded-full bg-[rgba(232,228,220,0.55)]" />
      <span className="header-weather-star header-weather-star-b absolute left-[28%] top-7 size-0.5 rounded-full bg-[rgba(232,228,220,0.45)]" />
      <span className="header-weather-star header-weather-star-c absolute left-[48%] top-2.5 size-1 rounded-full bg-[rgba(232,228,220,0.5)]" />
      <span className="header-weather-star header-weather-star-d absolute left-[66%] top-6 size-0.5 rounded-full bg-[rgba(232,228,220,0.4)]" />
      <span className="header-weather-star header-weather-star-e absolute left-[82%] top-4 size-1 rounded-full bg-[rgba(232,228,220,0.48)]" />
    </>
  );
}

const PARALLAX_CLOUD_CONDITIONS = new Set<WeatherCondition>([
  "partlyCloudy",
  "cloudy",
  "fog",
  "rain",
  "storm",
  "snow",
]);

/** Three seamless PNG strips; mood comes from CSS `[data-condition]` filters. */
function ParallaxClouds() {
  return (
    <div className="header-weather-parallax absolute inset-0">
      <div className="header-weather-parallax-layer header-weather-parallax-a absolute inset-0" />
      <div className="header-weather-parallax-layer header-weather-parallax-b absolute inset-0" />
      <div className="header-weather-parallax-layer header-weather-parallax-c absolute inset-0" />
    </div>
  );
}

type RainDrop = {
  x: number;
  y: number;
  /** Depth 0 (far) → 1 (near): drives speed, opacity, and streak width. */
  z: number;
  len: number;
  drift: number;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function seedDrops(count: number, width: number, height: number): RainDrop[] {
  const drops: RainDrop[] = [];
  for (let i = 0; i < count; i += 1) {
    const z = 0.25 + Math.random() * 0.75;
    drops.push({
      x: Math.random() * (width + 40) - 20,
      y: Math.random() * (height + 40) - 20,
      z,
      len: 6 + z * 10,
      drift: 0.35 + z * 0.55,
    });
  }
  return drops;
}

/**
 * Header-scoped canvas rain — short angled streaks with wind drift and depth.
 * Pauses on reduced motion and when the tab is hidden. No ground splashes.
 */
function HeaderRain({ storm }: { storm: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const parent = canvas.parentElement;
    if (!parent) {
      return;
    }

    let raf = 0;
    let running = true;
    let reduced = prefersReducedMotion();
    let drops: RainDrop[] = [];
    let lastTs = 0;
    const dropCount = storm ? 90 : 55;
    // Slight wind angle (radians from vertical).
    const wind = storm ? 0.22 : 0.14;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(1, Math.floor(rect.width));
      const cssH = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drops = seedDrops(dropCount, cssW, cssH);
    };

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      reduced = media.matches;
      if (reduced) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (raf !== 0) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
      } else {
        kick();
      }
    };

    const tick = (now: number) => {
      if (!running) {
        return;
      }

      if (reduced || document.visibilityState === "hidden") {
        raf = 0;
        return;
      }

      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const dt = lastTs === 0 ? 16 : Math.min(32, now - lastTs);
      lastTs = now;

      ctx.clearRect(0, 0, cssW, cssH);

      const sin = Math.sin(wind);
      const cos = Math.cos(wind);

      for (const drop of drops) {
        const speed = (1.6 + drop.z * 3.2) * (dt / 16);
        drop.x += sin * speed * drop.drift;
        drop.y += cos * speed * (0.85 + drop.z * 0.9);

        if (drop.y > cssH + drop.len || drop.x > cssW + 24 || drop.x < -24) {
          drop.x = Math.random() * (cssW + 40) - 20;
          drop.y = -drop.len - Math.random() * cssH * 0.3;
          drop.z = 0.25 + Math.random() * 0.75;
          drop.len = 6 + drop.z * 10;
          drop.drift = 0.35 + drop.z * 0.55;
        }

        const alpha = (storm ? 0.28 : 0.2) + drop.z * 0.35;
        const width = 0.6 + drop.z * 0.9;
        const tipX = drop.x + sin * drop.len;
        const tipY = drop.y + cos * drop.len;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(178, 196, 222, ${alpha})`;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }

      raf = window.requestAnimationFrame(tick);
    };

    const kick = () => {
      if (raf !== 0 || reduced) {
        return;
      }
      lastTs = 0;
      raf = window.requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        kick();
      } else if (raf !== 0) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    kick();

    return () => {
      running = false;
      ro.disconnect();
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf !== 0) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, [storm]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    />
  );
}

function SnowSpecks() {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="header-weather-snow absolute size-1.5 rounded-full bg-[rgba(230,232,236,0.55)]"
          style={{
            left: `${5 + ((i * 8) % 90)}%`,
            animationDelay: `${(i % 6) * 0.35}s`,
            animationDuration: `${4.5 + (i % 4) * 0.6}s`,
          }}
        />
      ))}
    </div>
  );
}

function StormFlash() {
  return <div className="header-weather-flash absolute inset-0" />;
}

function SunPaths() {
  return (
    <>
      <circle cx="8" cy="8" r="2.6" fill="currentColor" />
      <path
        d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  );
}

function MoonPaths() {
  return (
    <path
      d="M10.2 2.4A5.6 5.6 0 1 0 13.6 9.2 4.4 4.4 0 0 1 10.2 2.4Z"
      fill="currentColor"
    />
  );
}

function CloudPaths() {
  return (
    <path
      d="M4.8 11.5h7.2a2.6 2.6 0 0 0 .2-5.2 3.4 3.4 0 0 0-6.5-1.1A2.5 2.5 0 0 0 4.8 11.5Z"
      fill="currentColor"
    />
  );
}

function SunCloudPaths() {
  return (
    <>
      <circle cx="11" cy="5" r="1.7" fill="currentColor" />
      <path
        d="M11 1.7v.9M14.3 5h.9M13.4 2.6l-.6.6M13.4 7.4l-.6-.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M3.8 12.4h8a2.5 2.5 0 0 0 .18-5 3.2 3.2 0 0 0-6.15-1.05A2.35 2.35 0 0 0 3.8 12.4Z"
        fill="currentColor"
      />
    </>
  );
}

function MoonCloudPaths() {
  return (
    <>
      <path
        d="M11.4 2.6A3.8 3.8 0 1 0 13.6 7.4 3 3 0 0 1 11.4 2.6Z"
        fill="currentColor"
      />
      <path
        d="M3.8 12.6h8a2.5 2.5 0 0 0 .18-5 3.2 3.2 0 0 0-6.15-1.05A2.35 2.35 0 0 0 3.8 12.6Z"
        fill="currentColor"
      />
    </>
  );
}

function CloudRainPaths() {
  return (
    <>
      <path
        d="M4.5 8.8h7a2.3 2.3 0 0 0 .15-4.6 3 3 0 0 0-5.7-1A2.2 2.2 0 0 0 4.5 8.8Z"
        fill="currentColor"
      />
      <path
        d="M5.5 10.6v1.8M8 11v2M10.5 10.6v1.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  );
}

function SnowflakePaths() {
  return (
    <path
      d="M8 2.2v11.6M3.5 5l9 6M12.5 5l-9 6M4.2 3.8l1.4 1.4M10.4 10.8l1.4 1.4M11.8 3.8l-1.4 1.4M5.6 10.8l-1.4 1.4"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
  );
}

function LightningPaths() {
  return (
    <path
      d="M9.2 1.8 5.2 8.6h3L6.6 14.2 12.2 6.8H9.1L9.2 1.8Z"
      fill="currentColor"
    />
  );
}

function FogPaths() {
  return (
    <path
      d="M2.5 5h11M3.5 8h9M2.8 11h10.4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  );
}
