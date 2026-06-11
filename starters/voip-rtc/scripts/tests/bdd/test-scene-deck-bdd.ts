import { deckTargetFor, easeDeck, type DeckState } from "../../../src/components/scene/mode-director.js";
import { deckTransitionRate, staticFrameTimeMs } from "../../../src/components/scene/scene-motion-policy.js";
import { parseRgbTriplet } from "../../../src/components/scene/scene-theme.js";
import { scissorFor } from "../../../src/components/scene/view-registry.js";

const results = [
  scenarioScissorMapsRectsAndCullsOffscreen(),
  scenarioDeckTargetsAreBoundedAndDistinct(),
  scenarioDeckEasingConverges(),
  scenarioMotionPolicyGatesAnimation(),
  scenarioRgbTripletParsingIsStrict(),
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

function scenarioMotionPolicyGatesAnimation(): string {
  assert(deckTransitionRate(true) === 1, "reduced motion must snap transitions (rate 1)");
  const animated = deckTransitionRate(false);
  assert(animated > 0 && animated < 0.1, "animated transitions must ease gently");
  const frozen = staticFrameTimeMs();
  assert(Number.isFinite(frozen) && frozen > 0, "static renders need a fixed, pleasant pose time");
  assert(staticFrameTimeMs() === frozen, "the frozen pose must be deterministic");
  return "motion-policy-gates-animation";
}

function scenarioRgbTripletParsingIsStrict(): string {
  /* the design-system tokens are bare "r, g, b" triplets */
  const cyan = parseRgbTriplet("76,195,255");
  assert(cyan !== null && cyan[0] === 76 / 255 && cyan[2] === 1, "triplets must normalize to 0..1");
  const spaced = parseRgbTriplet(" 21, 95, 212 ");
  assert(spaced !== null && Math.abs(spaced[1] - 95 / 255) < 1e-9, "whitespace around components must be tolerated");
  assert(parseRgbTriplet("") === null, "empty values must be rejected");
  assert(parseRgbTriplet("a,b,c") === null, "non-numeric values must be rejected");
  assert(parseRgbTriplet("1,2") === null, "two components are not a triplet");
  assert(parseRgbTriplet("300,0,0") === null, "components above 255 must be rejected");
  return "rgb-triplet-parsing-is-strict";
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(JSON.stringify({ status: "failed", message }));
    process.exit(1);
  }
}
