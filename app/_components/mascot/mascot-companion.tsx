"use client";

import { memo, useEffect, useRef, useState } from "react";
import { RoosterFigure } from "@/app/_components/mascot/rooster-figure";
import {
  allowsAmbient,
  allowsLocomotion,
  allowsTips,
  allowsWakeReaction,
  shouldMountCompanion,
} from "@/app/_components/mascot/mascot-preferences";
import { useMascotPreferences } from "@/app/_components/mascot/mascot-provider";
import { useRoosterDirector } from "@/app/_components/mascot/use-rooster-director";
import { useWake } from "@/app/_components/wake-provider";
import { copy } from "@/src/copy";
import type { StateName } from "@/app/_components/mascot/states";

const SM_QUERY = "(min-width: 640px)";
const ROOSTER_WIDTH = 130;
/** Idle gap before the click streak resets. */
const STREAK_DECAY_MS = 2500;
/** After the punchline, ignore pokes so it can’t be farmed. */
const PUNCHLINE_COOLDOWN_MS = 12_000;

const RoosterFigureStable = memo(RoosterFigure);

type PokeBeat = {
  seq: StateName[];
  tip: string;
  tone: "accent" | "warn";
};

function pick(lines: readonly string[], avoid?: string): string {
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0]!;
  let choice = lines[Math.floor(Math.random() * lines.length)]!;
  if (avoid && lines.length > 1) {
    let guard = 0;
    while (choice === avoid && guard < 6) {
      choice = lines[Math.floor(Math.random() * lines.length)]!;
      guard += 1;
    }
  }
  return choice;
}

/** Warcraft-style annoyance ladder — order stays; lines vary within each tier. */
function beatForStreak(count: number, lastTip?: string): PokeBeat {
  if (count <= 2) {
    return {
      seq: [Math.random() < 0.5 ? "peck" : "curious"],
      tip: pick(copy.mascot.pokeAck, lastTip),
      tone: "accent",
    };
  }
  if (count <= 4) {
    return {
      seq: ["skeptic"],
      tip: pick(copy.mascot.pokeProtest, lastTip),
      tone: "warn",
    };
  }
  if (count <= 6) {
    return {
      seq: [count === 5 ? "alert" : "crow"],
      tip: pick(copy.mascot.pokeLouder, lastTip),
      tone: "warn",
    };
  }
  return {
    seq: ["alert", "skeptic"],
    tip: pick(copy.mascot.pokePunchlines, lastTip),
    tone: "warn",
  };
}

function useSmUp(): boolean {
  const [smUp, setSmUp] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(SM_QUERY);
    const sync = () => setSmUp(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return smUp;
}

/**
 * Fixed floor companion — above the FM dock, floor spans the left gutter.
 * Returns null (no RAF) when Show off or viewport &lt; sm.
 */
export function MascotCompanion() {
  const { prefs, hydrated } = useMascotPreferences();
  const { mascotEvent } = useWake();
  const smUp = useSmUp();

  const worldRef = useRef<HTMLDivElement>(null);
  const roosterWrapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pokeRef = useRef({
    count: 0,
    lastAt: 0,
    cooldownUntil: 0,
    lastTip: "",
  });

  const mount = hydrated && shouldMountCompanion(prefs, smUp);
  const active = mount;
  const ambient = mount && allowsAmbient(prefs);
  const locomotion = mount && allowsLocomotion(prefs);
  const tips = mount && allowsTips(prefs);

  const reaction =
    mascotEvent && mount && allowsWakeReaction(prefs)
      ? {
          id: mascotEvent.id,
          seq: (mascotEvent.outcome === "success"
            ? ["crow", "happy"]
            : ["alert", "skeptic"]) as StateName[],
          say: tips
            ? mascotEvent.outcome === "success"
              ? copy.mascot.wakeSuccessTip
              : copy.mascot.wakeFailureTip
            : undefined,
          tone:
            mascotEvent.outcome === "success"
              ? ("accent" as const)
              : ("warn" as const),
        }
      : null;

  const director = useRoosterDirector({
    active,
    ambient,
    allowLocomotion: locomotion,
    tips,
    quiet: true,
    grains: false,
    clickToWalk: false,
    pauseOnScroll: true,
    reaction,
    worldRef,
    roosterWrapRef,
    bubbleRef,
    roosterWidth: ROOSTER_WIDTH,
    initialX: 16,
    bubbleMaxWidth: 180,
  });

  const onPoke = () => {
    const now = performance.now();
    const streak = pokeRef.current;
    if (now < streak.cooldownUntil) {
      return;
    }

    if (now - streak.lastAt > STREAK_DECAY_MS) {
      streak.count = 0;
    }
    streak.count += 1;
    streak.lastAt = now;

    const beat = beatForStreak(streak.count, streak.lastTip);
    streak.lastTip = beat.tip;
    if (streak.count >= 7) {
      streak.cooldownUntil = now + PUNCHLINE_COOLDOWN_MS;
      streak.count = 0;
    }

    director.interrupt();
    director.enqueue(beat.seq);
    if (tips) {
      director.say(beat.tip, beat.tone);
    }
  };

  if (!mount) {
    return null;
  }

  return (
    <div className="mascot-companion pointer-events-none fixed z-[12]">
      <div
        ref={worldRef}
        className="mascot-companion-world relative h-[168px] overflow-visible"
      >
        <div
          className="mascot-floor absolute right-0 bottom-3 left-0 h-px opacity-60"
          aria-hidden
        />
        <div ref={bubbleRef} className="mascot-bubble" aria-live="polite" />
        <div
          ref={roosterWrapRef}
          className="mascot-rooster-wrap absolute bottom-0 left-0 z-[1] w-[130px] origin-bottom"
        >
          <RoosterFigureStable />
          {/* Small body hit target only — floor stays non-interactive for the dock. */}
          <button
            type="button"
            onClick={onPoke}
            aria-label={copy.mascot.pokeLabel}
            className="pointer-events-auto absolute bottom-[6%] left-1/2 z-[2] h-[68%] w-[56%] -translate-x-1/2 cursor-pointer rounded-[45%] bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
