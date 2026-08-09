# Rigging the RoosterAI mascot in Rive

Everything here assumes `rooster.svg` in this folder. Budget ~45 min for the rig, ~2 hours for all seven animations.

---

## 1. Import

New file → **Import** → `rooster.svg`. Rive keeps SVG groups as groups, so you land in the editor with this hierarchy already intact:

```
Rooster
├─ tail          (tail_c, tail_b, tail_a)
├─ leg_back      (shank, foot, toe)
├─ neck
├─ body
├─ wing          (shape + 2 feather lines)
├─ leg_front     (shank, foot, toe)
└─ head_rig
   ├─ wattle
   ├─ comb
   ├─ head
   ├─ beak_lower      ← separate so he can talk/crow
   ├─ beak_upper
   ├─ eye  (white, pupil, shine, lid, closed-line)
   └─ brow            ← cheap, and it carries most of the expression
```

**Do not flatten `head_rig`.** Its draw order (wattle and comb behind the skull) is what hides the seams. One bone on that group moves the entire face correctly.

Check draw order after import — if Rive reverses it, the fix is dragging `tail` to the back and `head_rig` to the front.

---

## 2. Bones

Nine bones. Place each one **exactly** at these coordinates (they're in the SVG's own units, and they're also written into `rooster.svg` as `data-pivot` attributes so you can verify):

| Bone | Position | Parent | Drives |
|---|---|---|---|
| `root` | 210, 366 | — | whole rig (hop, lean, ground contact) |
| `body` | 185, 230 | root | breathing squash |
| `neck` | 238, 206 | body | neck arc |
| `head` | 256, 150 | neck | `head_rig` |
| `jaw` | 348, 116 | head | `beak_lower` |
| `brow` | 306, 88 | head | `brow` |
| `wing` | 240, 206 | body | `wing` |
| `tail` | 170, 218 | body | `tail` |
| `leg_front` | 222, 278 | body | `leg_front` |
| `leg_back` | 172, 272 | body | `leg_back` |

`root` sits on the ground line (y=366) so rotating it tips the whole bird around its feet — that's what sells the peck.

Bind each group to its bone, then **reset the origin** so the group's transform origin lands on the bone. Legs bind at the hip so the whole leg swings as one piece; no knee joint, it's a mascot.

The eye lid is a scale, not a bone: `eye_lid` scales Y from 0 → 1 with its origin at **306, 84** (the top of the eye). At 0 it collapses out of sight; at 1 it covers the eye. Fade `eye_closed` in above 0.92 for the drawn-on sleeping eye.

---

## 3. The seven animations

Exact keyframe values are in `rooster-prototype.html` — the `STATES` object is the same math, so you can read amplitudes straight off it. Lengths and the essential beat of each:

| Animation | Length | The one thing that matters |
|---|---|---|
| `idle` | 3.6s loop | Body scales Y ±2%, head counter-bobs ~1.6px. Barely visible. If you can see it from across the room it's too much. |
| `walk` | 0.62s loop | Legs ±27° opposed, root bobs 3px. The head **holds still in world space** and snaps forward once per step — that head-lock is the whole gag. |
| `peck` | 1.35s, 2 pecks | Root rotates 12° forward so the whole bird tips; neck 46°, head 42° + 36px down. Head alone never reaches the ground — you need the body lean. |
| `happy` | 1.5s, 2 hops | Root up 36px, both legs tuck −20°, wing swings out −38°, beak opens. Squash the body 5% on landing. |
| `curious` | 2.6s, hold | Head cocks +17°, brow up −15°. Ease in over 0.3s, out over 0.45s. Nothing else moves. |
| `sleep` | 4.2s loop | Lid at 1, head tucked (neck 21°, head 13° + 13px down), breathing doubled to ±3%. |
| `alert` | 1.7s | Fast attack (0.1s), slow release (0.75s). Head snaps up −13°, brow −19°, tail +17°. A damped 46Hz shake on the first ~0.2s adds the startle. |

Two extras worth building — they're where the personality actually lives:

- **`crow`** (2.0s) — wind up 0.3s (head back −24°), then thrust forward +34° with the jaw open 22°. This is your "Wake the Flock Up" reaction.
- **`skeptic`** (2.4s) — brow rotates **down** +17°, lid to 0.34, small head shake. This is the "weak brief" face and it does more work than any text you could write.

---

## 4. State machine

One layer, one state machine. Inputs:

```
mood    (number)  0 idle · 1 curious · 2 happy · 3 skeptic · 4 sleep
walking (boolean) → walk ⇄ idle
react   (trigger) + reactId (number) → peck / alert / crow, then auto-return
```

Wire `react` transitions with **Exit Time** so one-shots always fall back to `idle` (or `walk` if `walking` is still true). Set transition duration to ~180ms on everything — the prototype crossfades at 220ms and that's roughly the right feel; anything snappier pops, anything slower feels underwater.

---

## 5. In React

The rooster's *internal* motion is Rive's job. Its *position on the page* is the DOM's job — don't try to move it inside the artboard.

```jsx
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

export function RoosterMascot({ event, x, facing = 1 }) {
  const { rive, RiveComponent } = useRive({
    src: '/rooster.riv',
    stateMachines: 'Mascot',
    autoplay: true,
  });
  const mood    = useStateMachineInput(rive, 'Mascot', 'mood');
  const walking = useStateMachineInput(rive, 'Mascot', 'walking');
  const react   = useStateMachineInput(rive, 'Mascot', 'react');

  // ...map RoosterAI events onto mood/react here

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, width: 160, height: 152,
        transform: `translateX(${x}px) scaleX(${facing})`,
        transition: 'transform 80ms linear', pointerEvents: 'none',
      }}
    >
      <RiveComponent />
    </div>
  );
}
```

Give the container ~10% more height than the artboard — the happy hop lifts the root 36 units and will clip otherwise.

---

## 6. Event map

Straight from the prototype, already tuned so he isn't annoying:

| RoosterAI event | Reaction | Line |
|---|---|---|
| New brief lands | `alert` | "Fresh brief is up." |
| Strong brief | `crow` → `happy` | "Good haul this morning." |
| Weak brief | `skeptic` | "Thin one today. Two sources went quiet." |
| Wake the Flock Up | `crow` | — |
| Rain in forecast | `curious` | "Rain at 14:00. Bring the coat." |
| Task stale 3+ days | `skeptic` → `curious` | "That task has sat 3 days." |
| Connector failing | `alert` → `skeptic` | "GA4 connector stopped answering." |
| Nothing for 45s | `sleep` | — |

**The quiet rule.** Ambient actions fire on a 9–22s random gap, and roughly 12% of those tick by doing nothing at all. That last part isn't laziness — a mascot that reacts to every click is uninstalled within ten minutes. The prototype's `director()` function is the reference implementation.

---

## 7. Palette

| | |
|---|---|
| Outline | `#17110D` |
| Head | `#E8873A` · Body `#E07B2C` · Neck `#D96A28` · Wing `#C25A1E` |
| Comb / wattle | `#E34A35` |
| Beak / legs | `#F7C948` · back leg `#C98A25` · lower beak `#D9A32E` |
| Tail | `#3E9FB0` / `#1B5C6B` / `#2C8496` |
| Eye | `#FBF6EA` |

Stroke weight 8 at the 420×400 artboard. Keep strokes **scaling with the shape** in Rive so he stays chunky at 120px and doesn't turn into hairlines.

For the Wix version later: the tail teal and the body orange are the two hues to swap per business. Comb, beak, and legs stay — they're what makes it read as a rooster rather than a blob.
