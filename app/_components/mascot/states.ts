/**
 * Procedural mascot states + channel helpers.
 * Ported from mascot/rooster-prototype.html — each state returns channel
 * deltas for local time t (seconds). `dur: null` loops until interrupted.
 */

export const CHANNELS = [
  "headR",
  "headX",
  "headY",
  "neckR",
  "bodyY",
  "bodySY",
  "wingR",
  "tailR",
  "legFR",
  "legBR",
  "jawR",
  "browR",
  "browY",
  "pupilX",
  "pupilY",
  "rootY",
  "rootR",
  "lid",
] as const;

export type Channel = (typeof CHANNELS)[number];
export type Pose = Record<Channel, number>;

export type StateName =
  | "idle"
  | "walk"
  | "peck"
  | "happy"
  | "curious"
  | "sleep"
  | "alert"
  | "crow"
  | "skeptic";

export type StateDef = {
  dur: number | null;
  fn: (t: number, c: Pose) => void;
};

export const TAU = Math.PI * 2;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** smoothstep */
export const ease = (v: number) => v * v * (3 - 2 * v);

export const env = (t: number, d: number, a: number, r: number) =>
  Math.min(ease(clamp01(t / a)), ease(clamp01((d - t) / r)));

export function zero(): Pose {
  return CHANNELS.reduce((o, k) => {
    o[k] = k === "bodySY" ? 1 : 0;
    return o;
  }, {} as Pose);
}

export const STATE_NAMES: StateName[] = [
  "idle",
  "walk",
  "peck",
  "happy",
  "curious",
  "sleep",
  "alert",
  "crow",
  "skeptic",
];

export const STATES: Record<StateName, StateDef> = {
  idle: {
    dur: null,
    fn(t, c) {
      const s = (TAU * t) / 3.6;
      c.bodySY = 1 + 0.02 * Math.sin(s);
      c.bodyY = -1.2 * Math.sin(s);
      c.headY = 1.6 * Math.sin(s + 0.5);
      c.headR = 1.1 * Math.sin(s + 0.9);
      c.neckR = -0.8 * Math.sin(s + 0.5);
      c.tailR = 2.6 * Math.sin((TAU * t) / 5.1);
      c.wingR = 1.4 * Math.sin(s + 0.3);
    },
  },

  /* Chicken walk: the head holds still in world space while the body
     travels under it, then snaps forward. That head-lock is the whole gag. */
  walk: {
    dur: null,
    fn(t, c) {
      const p = (t / 0.62) % 1;
      const s = TAU * p;
      c.legFR = 27 * Math.sin(s);
      c.legBR = 27 * Math.sin(s + Math.PI);
      c.rootY = -3.2 * Math.abs(Math.sin(s)) + 1.4;
      c.bodyY = -1.0 * Math.sin(2 * s);
      const thrust = Math.pow(clamp01((p * 2) % 1), 0.35);
      c.headX = -5 + 10 * thrust;
      c.headY = -c.rootY * 0.85;
      c.neckR = -4 * Math.sin(s);
      c.headR = 2.5 * Math.sin(s + 1.2);
      c.tailR = 4.5 * Math.sin(s);
      c.wingR = 3.2 * Math.sin(s + Math.PI);
    },
  },

  peck: {
    dur: 1.35,
    fn(t, c) {
      const u = (t / 0.675) % 1;
      const d = Math.pow(Math.sin(u * Math.PI), 0.65);
      c.neckR = 46 * d;
      c.headR = 42 * d;
      c.headY = 36 * d;
      c.headX = -20 * d;
      c.jawR = 16 * d * (u < 0.55 ? 1 : 0.2);
      c.rootR = 12 * d;
      c.tailR = -14 * d;
      c.bodyY = 4 * d;
      c.legFR = -8 * d;
      c.legBR = 8 * d;
    },
  },

  happy: {
    dur: 1.5,
    fn(t, c) {
      const u = (t / 0.75) % 1;
      const hop = Math.sin(u * Math.PI);
      c.rootY = -36 * hop;
      c.legFR = -20 * hop;
      c.legBR = -20 * hop;
      c.wingR = -38 * hop;
      c.tailR = 14 * hop;
      c.headR = -9 * hop;
      c.headY = -3 * hop;
      c.browR = -13 * hop;
      c.browY = -2.5 * hop;
      c.jawR = 15 * hop;
      c.bodySY = 1 + 0.05 * Math.sin(u * TAU);
      c.pupilY = -1.5 * hop;
    },
  },

  curious: {
    dur: 2.6,
    fn(t, c) {
      const e = env(t, 2.6, 0.3, 0.45);
      c.headR = 17 * e;
      c.headY = -2 * e;
      c.headX = 3 * e;
      c.neckR = -6 * e;
      c.browR = -15 * e;
      c.browY = -3 * e;
      c.pupilX = 2.2 * e;
      c.pupilY = -1 * e;
      c.tailR = -5 * e;
      const s = (TAU * t) / 3.2;
      c.bodySY = 1 + 0.016 * Math.sin(s);
    },
  },

  sleep: {
    dur: null,
    fn(t, c) {
      const s = (TAU * t) / 4.2;
      c.lid = 1;
      c.neckR = 21;
      c.headR = 13;
      c.headY = 13;
      c.headX = -9;
      c.tailR = -4;
      c.wingR = 2;
      c.bodySY = 1 + 0.032 * Math.sin(s);
      c.bodyY = -2.0 * Math.sin(s);
      c.rootY = 1.6 * Math.sin(s);
      c.browR = 6;
      c.browY = 3;
    },
  },

  alert: {
    dur: 1.7,
    fn(t, c) {
      const e = env(t, 1.7, 0.1, 0.75);
      const j = Math.exp(-t * 11) * Math.sin(t * 46);
      c.neckR = -15 * e + 3 * j;
      c.headR = -13 * e + 4 * j;
      c.headY = -9 * e;
      c.headX = 4 * e;
      c.browR = -19 * e;
      c.browY = -4.5 * e;
      c.tailR = 17 * e;
      c.wingR = -9 * e;
      c.rootY = -3 * e;
      c.pupilY = -2 * e;
    },
  },

  crow: {
    dur: 2.0,
    fn(t, c) {
      const wind = ease(clamp01(t / 0.3));
      const rel =
        Math.pow(clamp01((t - 0.3) / 0.3), 0.6) *
        ease(clamp01((2.0 - t) / 0.7));
      c.neckR = -20 * wind + 30 * rel;
      c.headR = -24 * wind + 34 * rel;
      c.headX = -7 * wind + 16 * rel;
      c.headY = -6 * wind + 4 * rel;
      c.jawR = 10 * wind + 22 * rel;
      c.browR = -16 * (wind + rel) * 0.7;
      c.wingR = -26 * Math.sin(clamp01(t / 2.0) * Math.PI);
      c.tailR = 18 * wind + 8 * rel;
      c.rootY = -7 * Math.sin(clamp01(t / 2.0) * Math.PI);
      c.bodySY = 1 + 0.04 * rel;
    },
  },

  skeptic: {
    dur: 2.4,
    fn(t, c) {
      const e = env(t, 2.4, 0.22, 0.5);
      const shake = Math.sin(t * 7.5) * Math.exp(-t * 1.2);
      c.headR = 12 * e + 4 * shake;
      c.headX = -4 * e;
      c.neckR = 5 * e;
      c.browR = 17 * e;
      c.browY = 2.5 * e;
      c.lid = 0.34 * e;
      c.tailR = -8 * e;
      c.wingR = 4 * e;
      c.pupilX = -1.5 * e;
    },
  },
};
