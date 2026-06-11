import { deckTargetFor, easeDeck, type DeckState } from "../../../src/components/scene/mode-director.js";
import { scissorFor } from "../../../src/components/scene/view-registry.js";

const results = [
  scenarioScissorMapsRectsAndCullsOffscreen(),
  scenarioDeckTargetsAreBoundedAndDistinct(),
  scenarioDeckEasingConverges(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioScissorMapsRectsAndCullsOffscreen(): string {
  /* a 200x100 rect at (40, 60) on a 1000x800 viewport: GL origin is the
     lower-left, so y = 800 - 60 - 100 = 640 */
  const box = scissorFor({ left: 40, top: 60, width: 200, height: 100 }, 1000, 800);
  assert(box !== null, "an on-screen rect must produce a scissor box");
  assert(box!.x === 40 && box!.y === 640 && box!.w === 200 && box!.h === 100, `wrong mapping: ${JSON.stringify(box)}`);

  /* fully above the viewport */
  assert(scissorFor({ left: 40, top: -200, width: 200, height: 100 }, 1000, 800) === null, "a rect above the viewport must be culled");
  /* fully below */
  assert(scissorFor({ left: 40, top: 900, width: 200, height: 100 }, 1000, 800) === null, "a rect below the viewport must be culled");
  /* fully left/right */
  assert(scissorFor({ left: -300, top: 60, width: 200, height: 100 }, 1000, 800) === null, "a rect left of the viewport must be culled");
  assert(scissorFor({ left: 1100, top: 60, width: 200, height: 100 }, 1000, 800) === null, "a rect right of the viewport must be culled");
  /* zero-size (display:none / unmounted) */
  assert(scissorFor({ left: 0, top: 0, width: 0, height: 0 }, 1000, 800) === null, "a zero-size rect must be culled");
  /* partially visible rects are kept (the GPU clamps the scissor) */
  assert(scissorFor({ left: -50, top: 60, width: 200, height: 100 }, 1000, 800) !== null, "a partially visible rect must be kept");

  return "scissor-maps-rects-and-culls-offscreen";
}

function scenarioDeckTargetsAreBoundedAndDistinct(): string {
  const modes = ["command", "builder", "agents", "rtc", "environment"];
  const states = modes.map((m) => deckTargetFor(m, 0));
  for (const s of states) {
    for (const v of [s.energy, s.anchorX, s.anchorY, s.hue, s.drift]) {
      assert(v >= 0 && v <= 1, `deck channels must stay in [0,1], got ${v}`);
    }
  }
  const keys = states.map((s) => `${s.energy}|${s.anchorX}|${s.anchorY}`);
  assert(new Set(keys).size === modes.length, "every mode must have its own deck signature");
  /* rtc dims the backdrop behind its opaque stage */
  assert(deckTargetFor("rtc", 0).energy < deckTargetFor("environment", 0).energy, "rtc backdrop must be dimmer than environment");
  /* builder intensity ramps energy monotonically and stays bounded */
  const cold = deckTargetFor("builder", 0).energy;
  const hot = deckTargetFor("builder", 1).energy;
  assert(hot > cold && hot <= 1, "builder energy must ramp with intensity and stay bounded");
  /* unknown mode falls back to a sane default, not NaN */
  const fallback = deckTargetFor("unknown", 0);
  assert(Number.isFinite(fallback.energy), "unknown modes must fall back safely");
  return "deck-targets-are-bounded-and-distinct";
}

function scenarioDeckEasingConverges(): string {
  let current: DeckState = { energy: 0, anchorX: 0, anchorY: 0, hue: 0, drift: 0 };
  const target = deckTargetFor("environment", 0);
  let previousDistance = Infinity;
  for (let i = 0; i < 600; i++) {
    current = easeDeck(current, target);
    const distance = Math.abs(current.energy - target.energy) + Math.abs(current.anchorX - target.anchorX);
    assert(distance <= previousDistance + 1e-9, "easing must approach the target monotonically");
    previousDistance = distance;
  }
  assert(previousDistance < 0.01, `600 frames (~10s) must converge, residual ${previousDistance}`);
  return "deck-easing-converges";
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(JSON.stringify({ status: "failed", message }));
    process.exit(1);
  }
}
