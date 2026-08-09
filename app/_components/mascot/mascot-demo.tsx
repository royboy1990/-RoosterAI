"use client";

import { memo, useRef, useState } from "react";
import { RoosterFigure } from "@/app/_components/mascot/rooster-figure";
import {
  STATE_NAMES,
  type StateName,
} from "@/app/_components/mascot/states";
import {
  useRoosterDirector,
  type EventDef,
} from "@/app/_components/mascot/use-rooster-director";

const EVENTS: Record<string, EventDef> = {
  "New brief": {
    seq: ["alert"],
    say: "Fresh brief is up.",
    tone: "accent",
  },
  "Strong brief": {
    seq: ["crow", "happy"],
    say: "Good haul this morning.",
    tone: "accent",
  },
  "Weak brief": {
    seq: ["skeptic"],
    say: "Thin one today. Two sources went quiet.",
    tone: "warn",
  },
  "Wake the flock": {
    seq: ["crow"],
    say: "COCK-A-DOODLE-DEPLOY",
    tone: "accent",
  },
  "Rain today": {
    seq: ["curious"],
    say: "Rain at 14:00. Bring the coat.",
  },
  "Task went stale": {
    seq: ["skeptic", "curious"],
    say: "That task has sat 3 days.",
    tone: "warn",
  },
  "Connector down": {
    seq: ["alert", "skeptic"],
    say: "GA4 connector stopped answering.",
    tone: "warn",
  },
};

/** Memoized so HUD React state updates never reset SVG transforms. */
const RoosterFigureStable = memo(RoosterFigure);

/**
 * Feel-test lab — stage world with grains, click-to-walk, and fake events.
 * Ignores companion Show preference; always runs its own director.
 */
export function MascotDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const roosterWrapRef = useRef<HTMLDivElement>(null);
  const grainsRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const [hudState, setHudState] = useState("idle");
  const [quiet, setQuiet] = useState(true);
  const [showPivots, setShowPivots] = useState(false);
  const [speed, setSpeed] = useState(1);
  const hudQuiet = quiet ? "on" : "off";

  const director = useRoosterDirector({
    active: true,
    ambient: true,
    allowLocomotion: true,
    tips: true,
    rate: speed,
    quiet,
    grains: true,
    clickToWalk: true,
    worldRef: stageRef,
    roosterWrapRef,
    bubbleRef,
    grainsRef,
    onStateChange: setHudState,
    roosterWidth: 210,
    initialX: 60,
  });

  const onStateClick = (name: StateName) => {
    director.interrupt();
    if (name === "walk") {
      director.setTarget(
        director.getX() + (director.getDir() > 0 ? 240 : -240),
      );
      director.play("walk");
    } else {
      director.play(name);
    }
  };

  const onEventClick = (name: string) => {
    const e = EVENTS[name];
    if (!e) return;
    director.fire(e);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          <span className="text-accent">RoosterAI</span>
          {" · "}
          mascot motion prototype
        </h1>
        <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-muted">
          Same rig you&apos;ll import into Rive — every part is a named group
          with a fixed pivot. Procedural states so you can judge the{" "}
          <em>feel</em> before animating. Leave it running: he&apos;s meant to
          be mostly quiet.
        </p>
      </div>

      <div
        ref={stageRef}
        className="mascot-stage relative min-h-[300px] cursor-pointer overflow-hidden rounded-[14px] border border-border sm:min-h-[360px]"
      >
        <div className="pointer-events-none absolute top-3 left-3.5 font-mono text-[11px] tracking-wide text-muted">
          state <b className="font-semibold text-accent">{hudState}</b>
          {" · "}
          quiet <b className="font-semibold text-accent">{hudQuiet}</b>
        </div>

        <div className="mascot-floor absolute right-0 bottom-16 left-0 h-px" aria-hidden />

        <div
          ref={grainsRef}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        />

        <div ref={bubbleRef} className="mascot-bubble" aria-live="polite" />

        <div
          ref={roosterWrapRef}
          className={`mascot-rooster-wrap absolute bottom-[47px] left-0 z-[1] w-[210px] origin-bottom will-change-transform${showPivots ? " showpivots" : ""}`}
        >
          <RoosterFigureStable />
        </div>
      </div>

      <div className="flex flex-wrap gap-5 sm:gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted">
            States (the 7 you&apos;ll build in Rive)
          </span>
          <div className="flex max-w-xl flex-wrap gap-1.5">
            {STATE_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onStateClick(n)}
                className="rounded-lg border border-accent-dim bg-surface px-3 py-1.5 text-[12.5px] text-accent transition-colors hover:border-accent hover:bg-accent hover:text-[#17110d]"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted">
            RoosterAI events
          </span>
          <div className="flex max-w-xl flex-wrap gap-1.5">
            {Object.keys(EVENTS).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onEventClick(n)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] text-foreground transition-colors hover:border-muted"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted">
            Rig
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={quiet}
              onChange={(e) => setQuiet(e.target.checked)}
              className="size-[15px] accent-accent"
            />
            quiet mode
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={showPivots}
              onChange={(e) => setShowPivots(e.target.checked)}
              className="size-[15px] accent-accent"
            />
            show bone pivots
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
            speed{" "}
            <input
              type="range"
              min={0.3}
              max={2}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-[120px] accent-accent"
            />
          </label>
          <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-muted">
            Quiet mode = long idle gaps, rare ambient actions. Turn it off to
            see him fidget more than he should.
          </p>
        </div>
      </div>
    </div>
  );
}
