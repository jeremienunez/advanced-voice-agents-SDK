# Lessons

## 2026-06-10 — Modify existing code, never layer a new implementation on top

Correction from Jeremie during the control-room refonte: I started adding a
"store" layer (transcript-store.ts) re-deriving state that the existing
pattern already handles (views subscribe directly to SessionDirector /
PolicyGate event streams). That is a parallel implementation on top of the
existing architecture — forbidden.

Rule: before writing a new module, check whether the behavior already exists
(prototype, existing pattern, existing file) and MIGRATE/MODIFY it in place.
New files are only for genuinely new responsibilities that the planned
architecture already names (e.g. a missing tab view), never for re-wrapping
existing data flows. Refonte = absorb the old into the structure, not stack
abstractions over it.

## 2026-06-10 — "le front" means THE existing front in the repo, explore before building

Second correction, same day, same root cause but worse: Jeremie said "tu
regardes comment l'archi du front est faite et tu me fais la refonte" — he
meant the EXISTING front in starters/voip-rtc. I instead kept building my
own examples/control-room app. He deleted examples/ himself. Rule: when the
user references "the front/the app/the API", FIRST locate the existing one
in the repo and read its architecture; never assume my previously created
artifact is the referent. Demos I create are scaffolding, not the product.

## 2026-06-10 — generative visuals: judge the output like the user, with their reference

Two corrections on the hologram face ("tu veux foutre la frousse au gosse" /
"pose-toi la question: est-ce que j'aimerais ressembler à ça"). I shipped a
procedural face after checking only geometry tests — never asking whether a
human would find it pleasant. Then I tuned constants for several rounds with
a misleading 1px-dot preview while the browser was the ground truth.

Rules:
- Before presenting generated visuals, apply the user's own test: would a
  person want to look like / use this? Screenshot and LOOK first.
- When the user provides a reference image, match its visual LANGUAGE
  (structure, lighting, density) — not just the subject.
- Build the tightest feedback loop available (offline render tool was right)
  but verify it matches the real renderer (point size, additive blending,
  exposure) before trusting it for tuning decisions.
- Frontal point-cloud relief reads through VALUE (dark wells, lit ridges) and
  perspective row curvature, not through depth or lambert with frontal light.

## 2026-06-11 — face-scan fidelity pass
- When the user asks for FIDELITY to a reference, hand-sculpted SDF
  ellipsoids cap out fast: extract real data from the reference instead
  (landmarks via lib, photo luminance as the value map) and keep math
  layers only for what the photo cannot cover (skull, hair, neck).
- Automatic silhouette tracing against a low-contrast backdrop (dark
  hair / dark studio wall) is unreliable from both directions
  (edge-inward catches clutter, center-outward stops early on shadows).
  Reading the contour visually off a grid overlay and hard-coding the
  point list was faster and exact — document it as hand-traced.
- Keep the shader's facial anchors (eyes ±0.2/0.12, mouth -0.345) as the
  registration target so every existing animation (blink, murmur, mood)
  keeps working on imported geometry.

## 2026-06-11 — bust extension (the "growth book" entry, per user)
- THE METHOD: when a data-driven pass works for one part (face), apply
  the SAME pass to adjacent parts (skull, then neck/shoulders) instead
  of keeping hand-crafted geometry next to computed geometry. The user
  considers applying a proven method consistently to be the definition
  of working intelligently — reach for it before being asked.
- Never bolt hand heuristics (cylinder blends, dimension caps) on top of
  measured data to fix an artifact. Find why the data reads wrong first:
  the "wobbly neck" was chin occlusion in the profile view (a real
  visual-hull limit), and the "plate-stack shoulders" was constant-y
  ring sampling on a near-horizontal surface. Both had data-respecting
  fixes (honest shadow gap; arc-length/adaptive sampling, superellipse
  sections = the true two-view hull).
- When a shared constant changes (shader camera), grep for every other
  GLSL/code that duplicates it (stage props had their own copy at the
  old z and silently de-synced).
