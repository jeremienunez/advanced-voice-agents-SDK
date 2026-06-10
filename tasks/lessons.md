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
