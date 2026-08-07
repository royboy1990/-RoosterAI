"use client";

import { useEffect, useRef } from "react";
import { useRoosterFM } from "@/app/_components/rooster-fm-provider";

const IDLE_ENERGY = 0.12;
const LERP_HIDDEN = 0.08;
const LERP_ACTIVE = 0.18;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readBass(
  analyser: AnalyserNode | null,
  buffer: Uint8Array<ArrayBuffer>,
): number {
  if (!analyser) {
    return 0;
  }
  analyser.getByteFrequencyData(buffer);
  // Low bins ≈ bass for a soft dawn pulse (fftSize 128 → 64 bins).
  const bins = Math.min(6, buffer.length);
  let sum = 0;
  for (let i = 0; i < bins; i += 1) {
    sum += buffer[i] ?? 0;
  }
  return bins === 0 ? 0 : sum / (bins * 255);
}

function paintField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  energy: number,
  timeMs: number,
  animate: boolean,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, width, height);

  const driftX = animate ? Math.sin(timeMs * 0.00015) * width * 0.04 : 0;
  const driftY = animate ? Math.cos(timeMs * 0.00011) * height * 0.03 : 0;
  const cx = width * 0.5 + driftX;
  const cy = height * 0.62 + driftY;
  const radius = Math.max(width, height) * (0.42 + energy * 0.38);
  const alpha = 0.1 + energy * 0.28;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, `rgba(240, 160, 48, ${alpha})`);
  glow.addColorStop(0.45, `rgba(196, 126, 26, ${alpha * 0.45})`);
  glow.addColorStop(1, "rgba(18, 18, 18, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  if (animate && energy > 0.18) {
    const ribbonY = height * 0.55 + Math.sin(timeMs * 0.0008) * height * 0.04;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(240, 160, 48, ${0.08 + energy * 0.12})`;
    ctx.lineWidth = 1.25;
    for (let x = 0; x <= width; x += 8) {
      const y =
        ribbonY +
        Math.sin(x * 0.012 + timeMs * 0.0012) * (8 + energy * 18) +
        Math.sin(x * 0.004 + timeMs * 0.0005) * energy * 10;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

export function AmbientCanvas() {
  const { analyser, isPlaying, visualsEnabled } = useRoosterFM();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const energyRef = useRef(IDLE_ENERGY);
  const freqBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let raf = 0;
    let running = true;
    let reduced = prefersReducedMotion();

    const resize = () => {
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      // Half CSS resolution; cap DPR contribution so the bitmap stays cheap.
      const scale = 0.5;
      canvas.width = Math.max(1, Math.floor(cssW * scale));
      canvas.height = Math.max(1, Math.floor(cssH * scale));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      reduced = media.matches;
    };
    media.addEventListener("change", onMotion);
    window.addEventListener("resize", resize);
    resize();

    const tick = (now: number) => {
      if (!running) {
        return;
      }

      const hidden = document.visibilityState === "hidden";
      const wantPulse =
        !reduced && visualsEnabled && isPlaying && !hidden;

      let target = IDLE_ENERGY;
      if (wantPulse) {
        if (
          !freqBufRef.current ||
          freqBufRef.current.length !== (analyser?.frequencyBinCount ?? 0)
        ) {
          freqBufRef.current = new Uint8Array(
            new ArrayBuffer(analyser?.frequencyBinCount ?? 0),
          );
        }
        const bass = readBass(analyser, freqBufRef.current);
        target = IDLE_ENERGY + bass * 0.75;
      }

      const lerp = wantPulse ? LERP_ACTIVE : LERP_HIDDEN;
      energyRef.current += (target - energyRef.current) * lerp;

      paintField(
        ctx,
        canvas.width,
        canvas.height,
        energyRef.current,
        now,
        !reduced && visualsEnabled,
      );

      const nearIdle =
        !wantPulse && Math.abs(energyRef.current - IDLE_ENERGY) < 0.004;
      if (nearIdle) {
        energyRef.current = IDLE_ENERGY;
        paintField(
          ctx,
          canvas.width,
          canvas.height,
          IDLE_ENERGY,
          now,
          false,
        );
        raf = 0;
        return;
      }

      raf = window.requestAnimationFrame(tick);
    };

    const kick = () => {
      if (raf !== 0) {
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      kick();
    };

    document.addEventListener("visibilitychange", onVisibility);
    kick();

    return () => {
      running = false;
      media.removeEventListener("change", onMotion);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf !== 0) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, [analyser, isPlaying, visualsEnabled]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
