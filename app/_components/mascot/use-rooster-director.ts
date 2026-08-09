"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import {
  CHANNELS,
  STATES,
  clamp01,
  ease,
  zero,
  type Pose,
  type StateName,
} from "@/app/_components/mascot/states";

/* ------------------------------------------------------------------ *
 *  RIG — one entry per animatable group. ox/oy is the bone pivot.
 * ------------------------------------------------------------------ */
type RigKey =
  | "head"
  | "neck"
  | "body"
  | "wing"
  | "tail"
  | "legF"
  | "legB"
  | "jaw"
  | "brow"
  | "root";

type RigPart = { id: string; ox: number; oy: number; el: SVGGElement | null };

const RIG_DEFS: Record<RigKey, { id: string; ox: number; oy: number }> = {
  head: { id: "head_rig", ox: 256, oy: 150 },
  neck: { id: "neck", ox: 238, oy: 206 },
  body: { id: "body", ox: 185, oy: 230 },
  wing: { id: "wing", ox: 240, oy: 206 },
  tail: { id: "tail", ox: 170, oy: 218 },
  legF: { id: "leg_front", ox: 222, oy: 278 },
  legB: { id: "leg_back", ox: 172, oy: 272 },
  jaw: { id: "beak_lower", ox: 348, oy: 116 },
  brow: { id: "brow", ox: 306, oy: 88 },
  root: { id: "Rooster", ox: 210, oy: 366 },
};

const BLEND = 0.22;
const WALK_SPEED = 62;

type Grain = { el: HTMLDivElement; x: number; gone: boolean };

type Engine = {
  cur: StateName;
  curT: number;
  prevSnap: Pose | null;
  blendT: number;
  queue: StateName[];
  lastPose: Pose;
  nextBlink: number;
  blinkAt: number;
  clock: number;
  x: number;
  dir: number;
  target: number | null;
  grains: Grain[];
  quiet: boolean;
  nextAmbient: number;
  lastEvent: number;
  lastReactionId: string | null;
  rate: number;
  sayTimer: ReturnType<typeof setTimeout> | null;
};

function createEngine(initialX: number): Engine {
  return {
    cur: "idle",
    curT: 0,
    prevSnap: null,
    blendT: 0,
    queue: [],
    lastPose: zero(),
    nextBlink: 2.5,
    blinkAt: -9,
    clock: 0,
    x: initialX,
    dir: 1,
    target: null,
    grains: [],
    quiet: true,
    nextAmbient: 6,
    lastEvent: 0,
    lastReactionId: null,
    rate: 1,
    sayTimer: null,
  };
}

export type EventDef = {
  seq: StateName[];
  say: string;
  tone?: "accent" | "warn";
};

export type RoosterDirectorOptions = {
  active: boolean;
  /** Quiet ambient director (peck / curious / stroll). Full motion only. */
  ambient: boolean;
  allowLocomotion: boolean;
  /** When false, say() never shows the bubble (Tips off). */
  tips: boolean;
  rate?: number;
  quiet?: boolean;
  /** Lab stage: seed grains and include them in ambient. */
  grains?: boolean;
  /** Lab stage: click world to walk. */
  clickToWalk?: boolean;
  /**
   * Pause RAF while the page scrolls (companion). Avoids compositor flashes
   * from a continuously updating fixed layer during scroll.
   */
  pauseOnScroll?: boolean;
  /** One-shot reaction (e.g. Wake). Deduped by id on the engine across remounts. */
  reaction?: {
    id: string;
    seq: StateName[];
    say?: string;
    tone?: "accent" | "warn";
  } | null;
  worldRef: RefObject<HTMLElement | null>;
  roosterWrapRef: RefObject<HTMLDivElement | null>;
  bubbleRef: RefObject<HTMLDivElement | null>;
  grainsRef?: RefObject<HTMLDivElement | null>;
  onStateChange?: (name: StateName) => void;
  /** Visual width used for placement / clamp (default 210). */
  roosterWidth?: number;
  initialX?: number;
  /** Bubble horizontal inset from world edges. */
  bubbleMaxWidth?: number;
};

export type RoosterDirectorApi = {
  play: (name: StateName) => void;
  enqueue: (list: StateName[]) => void;
  say: (text: string, tone?: string) => void;
  setTarget: (x: number | null) => void;
  fire: (def: EventDef) => void;
  interrupt: () => void;
  getX: () => number;
  getDir: () => number;
  getClock: () => number;
};

/**
 * Shared animation brain for lab stage + viewport companion.
 * When `active` is false the RAF loop is cancelled (no hidden work).
 */
export function useRoosterDirector(
  options: RoosterDirectorOptions,
): RoosterDirectorApi {
  const {
    active,
    ambient,
    allowLocomotion,
    tips,
    rate = 1,
    quiet = true,
    grains = false,
    clickToWalk = false,
    pauseOnScroll = false,
    reaction = null,
    worldRef,
    roosterWrapRef,
    bubbleRef,
    grainsRef,
    onStateChange,
    roosterWidth = 210,
    initialX = 60,
    bubbleMaxWidth = 240,
  } = options;

  const lidRef = useRef<SVGEllipseElement | null>(null);
  const closedRef = useRef<SVGPathElement | null>(null);
  const pupilRef = useRef<SVGCircleElement | null>(null);
  const shineRef = useRef<SVGCircleElement | null>(null);
  const rigRef = useRef<Record<RigKey, RigPart> | null>(null);
  const engineRef = useRef<Engine>(createEngine(initialX));
  const apiRef = useRef<RoosterDirectorApi | null>(null);

  const optsRef = useRef({
    ambient,
    allowLocomotion,
    tips,
    grains,
    roosterWidth,
    bubbleMaxWidth,
    onStateChange,
    reaction,
  });
  optsRef.current = {
    ambient,
    allowLocomotion,
    tips,
    grains,
    roosterWidth,
    bubbleMaxWidth,
    onStateChange,
    reaction,
  };

  const bindDom = useCallback(() => {
    const wrap = roosterWrapRef.current;
    if (!wrap) return false;
    const root = wrap.querySelector("svg");
    if (!root) return false;

    const rig = {} as Record<RigKey, RigPart>;
    for (const key of Object.keys(RIG_DEFS) as RigKey[]) {
      const def = RIG_DEFS[key];
      const el = root.querySelector(`#${CSS.escape(def.id)}`) as SVGGElement | null;
      rig[key] = { ...def, el };
    }
    rigRef.current = rig;

    lidRef.current = root.querySelector("#eye_lid");
    closedRef.current = root.querySelector("#eye_closed");
    pupilRef.current = root.querySelector("#eye_pupil");
    shineRef.current = root.querySelector("#eye_shine");
    return true;
  }, [roosterWrapRef]);

  const setPart = useCallback(
    (
      name: RigKey,
      x: number,
      y: number,
      r: number,
      sx?: number,
      sy?: number,
    ) => {
      const rig = rigRef.current;
      if (!rig) return;
      const p = rig[name];
      if (!p.el) return;
      const sxv = sx === undefined ? 1 : sx;
      const syv = sy === undefined ? 1 : sy;
      p.el.setAttribute(
        "transform",
        `translate(${(p.ox + x).toFixed(2)} ${(p.oy + y).toFixed(2)}) rotate(${r.toFixed(2)}) ` +
          `scale(${sxv.toFixed(3)} ${syv.toFixed(3)}) translate(${-p.ox} ${-p.oy})`,
      );
    },
    [],
  );

  const applyPose = useCallback(
    (c: Pose) => {
      setPart("head", c.headX, c.headY, c.headR);
      setPart("neck", 0, 0, c.neckR);
      setPart("body", 0, c.bodyY, 0, 1, c.bodySY);
      setPart("wing", 0, 0, c.wingR);
      setPart("tail", 0, 0, c.tailR);
      setPart("legF", 0, 0, c.legFR);
      setPart("legB", 0, 0, c.legBR);
      setPart("jaw", 0, 0, c.jawR);
      setPart("brow", 0, c.browY, c.browR);
      setPart("root", 0, c.rootY, c.rootR);

      const L = Math.max(0, Math.min(1, c.lid));
      lidRef.current?.setAttribute(
        "transform",
        `translate(306 84) scale(1 ${L.toFixed(3)}) translate(-306 -84)`,
      );
      closedRef.current?.setAttribute(
        "opacity",
        L > 0.92 ? ((L - 0.92) / 0.08).toFixed(2) : "0",
      );
      const px = c.pupilX;
      const py = c.pupilY;
      pupilRef.current?.setAttribute("transform", `translate(${px} ${py})`);
      shineRef.current?.setAttribute("transform", `translate(${px} ${py})`);
    },
    [setPart],
  );

  useEffect(() => {
    engineRef.current.quiet = quiet;
  }, [quiet]);

  useEffect(() => {
    engineRef.current.rate = rate;
  }, [rate]);

  useEffect(() => {
    if (!tips) {
      const bubbleEl = bubbleRef.current;
      if (bubbleEl) {
        bubbleEl.className = "mascot-bubble";
        bubbleEl.textContent = "";
      }
      const eng = engineRef.current;
      if (eng.sayTimer) {
        clearTimeout(eng.sayTimer);
        eng.sayTimer = null;
      }
    }
  }, [tips, bubbleRef]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const eng = engineRef.current;
    bindDom();

    const worldEl = worldRef.current;
    const roosterEl = roosterWrapRef.current;
    const bubbleEl = bubbleRef.current;
    if (!worldEl || !roosterEl || !bubbleEl) {
      return;
    }

    const grainsEl = grains ? grainsRef?.current ?? null : null;

    function say(text: string, tone?: string) {
      if (!optsRef.current.tips) {
        return;
      }
      bubbleEl!.textContent = text;
      bubbleEl!.className =
        "mascot-bubble on" + (tone ? ` ${tone}` : "");
      if (eng.sayTimer) clearTimeout(eng.sayTimer);
      eng.sayTimer = setTimeout(() => {
        bubbleEl!.className = "mascot-bubble" + (tone ? ` ${tone}` : "");
      }, 3400);
    }

    function play(name: StateName) {
      if (STATES[name]) {
        eng.prevSnap = eng.lastPose;
        eng.blendT = 0;
        eng.cur = name;
        eng.curT = 0;
      }
      optsRef.current.onStateChange?.(name);
    }

    function nextInQueue() {
      if (eng.queue.length) play(eng.queue.shift()!);
    }

    function enqueue(list: StateName[]) {
      eng.queue = list.slice();
      nextInQueue();
    }

    function blinkValue() {
      if (eng.clock > eng.nextBlink) {
        eng.blinkAt = eng.clock;
        eng.nextBlink = eng.clock + 2.6 + Math.random() * 5.5;
      }
      const b = eng.clock - eng.blinkAt;
      if (b < 0 || b > 0.19) return 0;
      return Math.sin((b / 0.19) * Math.PI);
    }

    function idleOrWalk(): StateName {
      return eng.target !== null ? "walk" : "idle";
    }

    function evaluate(dt: number): Pose {
      const st = STATES[eng.cur];
      eng.curT += dt;
      if (st.dur !== null && eng.curT >= st.dur) {
        if (eng.queue.length) nextInQueue();
        else play(idleOrWalk());
        return evaluate(0);
      }
      const c = zero();
      st.fn(eng.curT, c);

      if (eng.cur !== "sleep") c.lid = Math.max(c.lid, blinkValue());

      if (eng.prevSnap && eng.blendT < BLEND) {
        eng.blendT += dt;
        const k = ease(clamp01(eng.blendT / BLEND));
        for (const key of CHANNELS) {
          c[key] = eng.prevSnap[key] + (c[key] - eng.prevSnap[key]) * k;
        }
      } else {
        eng.prevSnap = null;
      }

      eng.lastPose = c;
      return c;
    }

    function locomote(dt: number) {
      if (!optsRef.current.allowLocomotion) {
        if (eng.target !== null) {
          eng.target = null;
          if (eng.cur === "walk") play("idle");
        }
        return;
      }
      if (eng.target === null) return;
      const d = eng.target - eng.x;
      if (Math.abs(d) < 3) {
        eng.target = null;
        if (eng.cur === "walk") play("idle");
        return;
      }
      eng.dir = d > 0 ? 1 : -1;
      eng.x += eng.dir * WALK_SPEED * dt;
      if (eng.cur !== "walk" && STATES[eng.cur].dur === null) play("walk");
    }

    function placeRooster() {
      const w = optsRef.current.roosterWidth;
      const bubbleW = optsRef.current.bubbleMaxWidth;
      roosterEl!.style.transform = `translateX(${eng.x.toFixed(1)}px) scaleX(${eng.dir})`;
      bubbleEl!.style.left =
        Math.max(
          8,
          Math.min(
            eng.x + (eng.dir > 0 ? w * 0.33 : w * 0.1),
            worldEl!.clientWidth - bubbleW,
          ),
        ) + "px";
    }

    function seedGrains() {
      if (!grainsEl) return;
      grainsEl.innerHTML = "";
      eng.grains = [];
      const w = worldEl!.clientWidth;
      for (let i = 0; i < 5; i++) {
        const g = document.createElement("div");
        g.className = "mascot-grain";
        const gx = 70 + Math.random() * Math.max(40, w - 180);
        g.style.left = gx + "px";
        g.style.bottom = 52 + Math.random() * 8 + "px";
        grainsEl.appendChild(g);
        eng.grains.push({ el: g, x: gx, gone: false });
      }
    }

    function nearestGrain() {
      let best: Grain | null = null;
      let bd = 1e9;
      const half = optsRef.current.roosterWidth * 0.5;
      for (const g of eng.grains) {
        if (g.gone) continue;
        const d = Math.abs(eng.x + half - g.x);
        if (d < bd) {
          bd = d;
          best = g;
        }
      }
      return bd < 460 ? best : null;
    }

    function eatGrain(g: Grain | null) {
      if (!g || g.gone || !grainsEl) return;
      g.gone = true;
      g.el.classList.add("eaten");
      setTimeout(() => {
        const w = worldEl!.clientWidth;
        g.x = 70 + Math.random() * Math.max(40, w - 180);
        g.el.style.left = g.x + "px";
        g.el.classList.remove("eaten");
        g.gone = false;
      }, 9000 + Math.random() * 9000);
    }

    function director() {
      if (!optsRef.current.ambient) return;
      if (eng.clock < eng.nextAmbient) return;
      const gap = eng.quiet
        ? 9 + Math.random() * 13
        : 3.5 + Math.random() * 4;
      eng.nextAmbient = eng.clock + gap;
      if (
        STATES[eng.cur].dur !== null ||
        eng.cur === "walk" ||
        eng.target !== null
      ) {
        return;
      }

      const half = optsRef.current.roosterWidth * 0.5;
      const g = optsRef.current.grains ? nearestGrain() : null;
      const roll = Math.random();
      const maxX = Math.max(10, worldEl!.clientWidth - optsRef.current.roosterWidth);

      if (g && roll < 0.42 && optsRef.current.allowLocomotion) {
        eng.target = g.x - half;
        setTimeout(() => {
          if (eng.target === null) {
            play("peck");
            eatGrain(g);
          }
        }, 900);
      } else if (roll < 0.6) {
        play("peck");
      } else if (roll < 0.74) {
        play("curious");
      } else if (roll < 0.88 && optsRef.current.allowLocomotion) {
        eng.target = 40 + Math.random() * Math.max(20, maxX - 40);
      }
    }

    function drowsy() {
      if (!optsRef.current.ambient) return;
      if (!eng.quiet) return;
      if (
        eng.clock - eng.lastEvent > 46 &&
        eng.cur === "idle" &&
        eng.target === null
      ) {
        play("sleep");
      }
    }

    function interrupt() {
      eng.lastEvent = eng.clock;
      eng.target = null;
      eng.queue = [];
    }

    function setTarget(x: number | null) {
      if (x !== null && !optsRef.current.allowLocomotion) {
        return;
      }
      eng.target = x;
    }

    function fire(def: EventDef) {
      eng.lastEvent = eng.clock;
      eng.nextAmbient = eng.clock + 5;
      eng.target = null;
      enqueue(def.seq);
      if (def.say) say(def.say, def.tone);
    }

    function applyReaction() {
      const r = optsRef.current.reaction;
      if (!r || eng.lastReactionId === r.id) return;
      eng.lastReactionId = r.id;
      fire({
        seq: r.seq,
        say: r.say ?? "",
        tone: r.tone,
      });
    }

    const api: RoosterDirectorApi = {
      play,
      enqueue,
      say,
      setTarget,
      fire,
      interrupt,
      getX: () => eng.x,
      getDir: () => eng.dir,
      getClock: () => eng.clock,
    };
    apiRef.current = api;

    let last = performance.now();
    let raf = 0;
    let alive = true;
    let scrolling = false;
    let scrollResumeTimer: ReturnType<typeof setTimeout> | null = null;

    function kick() {
      if (!alive || raf !== 0) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function frame(now: number) {
      if (!alive) return;
      raf = 0;
      if (scrolling) {
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05) * eng.rate;
      last = now;
      eng.clock += dt;
      locomote(dt);
      director();
      drowsy();
      applyPose(evaluate(dt));
      placeRooster();
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      if (grains) seedGrains();
      const maxX = Math.max(0, worldEl!.clientWidth - optsRef.current.roosterWidth);
      eng.x = Math.min(eng.x, maxX);
      placeRooster();
    };

    const onWorldClick = (ev: globalThis.MouseEvent) => {
      if (!optsRef.current.allowLocomotion) return;
      const r = worldEl!.getBoundingClientRect();
      eng.lastEvent = eng.clock;
      eng.queue = [];
      eng.target = Math.max(
        10,
        Math.min(
          ev.clientX - r.left - optsRef.current.roosterWidth * 0.5,
          worldEl!.clientWidth - optsRef.current.roosterWidth,
        ),
      );
    };

    const onScroll = () => {
      scrolling = true;
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (scrollResumeTimer) clearTimeout(scrollResumeTimer);
      scrollResumeTimer = setTimeout(() => {
        scrolling = false;
        scrollResumeTimer = null;
        kick();
      }, 140);
    };

    if (grains) seedGrains();
    // Fresh engine only — avoid clobbering an in-flight reaction after remount.
    if (eng.clock === 0) {
      play("idle");
    }
    applyReaction();
    placeRooster();
    window.addEventListener("resize", onResize);
    if (clickToWalk) {
      worldEl.addEventListener("click", onWorldClick);
    }
    if (pauseOnScroll) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    kick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (scrollResumeTimer) clearTimeout(scrollResumeTimer);
      window.removeEventListener("resize", onResize);
      if (clickToWalk) {
        worldEl.removeEventListener("click", onWorldClick);
      }
      if (pauseOnScroll) {
        window.removeEventListener("scroll", onScroll);
      }
      if (eng.sayTimer) clearTimeout(eng.sayTimer);
      if (apiRef.current === api) {
        apiRef.current = null;
      }
    };
  }, [
    active,
    applyPose,
    bindDom,
    bubbleRef,
    clickToWalk,
    grains,
    grainsRef,
    pauseOnScroll,
    roosterWrapRef,
    worldRef,
  ]);

  // Wake (and similar) one-shots while the loop is already running.
  useEffect(() => {
    if (!active || !reaction) return;
    const eng = engineRef.current;
    if (eng.lastReactionId === reaction.id) return;
    eng.lastReactionId = reaction.id;
    apiRef.current?.fire({
      seq: reaction.seq,
      say: reaction.say ?? "",
      tone: reaction.tone,
    });
  }, [active, reaction]);

  const stubApi = useRef<RoosterDirectorApi>({
    play: () => {},
    enqueue: () => {},
    say: () => {},
    setTarget: () => {},
    fire: () => {},
    interrupt: () => {},
    getX: () => engineRef.current.x,
    getDir: () => engineRef.current.dir,
    getClock: () => engineRef.current.clock,
  });

  // Stable facade — callers keep a reference; live methods go through apiRef.
  const facade = useRef<RoosterDirectorApi>({
    play: (name) => apiRef.current?.play(name),
    enqueue: (list) => apiRef.current?.enqueue(list),
    say: (text, tone) => apiRef.current?.say(text, tone),
    setTarget: (x) => apiRef.current?.setTarget(x),
    fire: (def) => apiRef.current?.fire(def),
    interrupt: () => apiRef.current?.interrupt(),
    getX: () => apiRef.current?.getX() ?? stubApi.current.getX(),
    getDir: () => apiRef.current?.getDir() ?? stubApi.current.getDir(),
    getClock: () => apiRef.current?.getClock() ?? stubApi.current.getClock(),
  });

  return facade.current;
}
