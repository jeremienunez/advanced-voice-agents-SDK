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

## 2026-06-11 — read the CI before writing a line (user correction)
- This repo has a WRITTEN definition of done: `pnpm audit:solid` (the
  quality matrix in scripts/quality/matrix.ts = what .github/workflows/ci.yml
  runs). Running "my BDD file + tsc" is NOT done. Read the CI and the
  audit scripts at session start, before producing code.
- Hard rules I violated today and the user had to fix by hand:
  audit:loc = 300 LOC max per handwritten file INCLUDING scripts/
  (pack-face-scan.ts ~430); audit:responsibility = max 5 runtime exports
  per module (face-geometry.ts had 8+) → his face-masks/face-sdf/orb-rng
  and pack-face-scan-* splits are conformity fixes of MY code.
- Other standing rules: no concrete inheritance (ports/composition),
  layer purity (UI≠node runtime, domain pure, core product-agnostic),
  no cycles, no vague filenames, barrel-only for index/state/routing,
  one component per tsx, generated files named *.generated.* for audit
  exemption (face-scan.ts should be renamed).

## 2026-06-11 — shared working tree: other agents/the user edit concurrently

Jeremie ran another LLM on the hologram while I executed the deck plan
("j'ai mis un autre llm sur la correction, attend la passe" then "touche
pas"). A runtime error appeared in a file I'm forbidden to modify
(face-geometry.ts beardMask) — it was a mid-save snapshot of THEIR work,
not a regression to fix.
- `git status` before every verification batch and before every commit:
  unexpected modified files = concurrent work in flight. Never "fix" an
  error originating in a file someone else is editing; report and wait.
- NEVER `git add -A` in this repo. Stage explicit paths only, and
  `git diff <paths>` first to confirm only my changes are in them.
- When told to wait, stop ALL repo writes (code, git, browser reloads can
  also race their dev loop) and state plainly what was already committed.

## 2026-06-12 — Never commit; Jeremie tests live first and commits himself

Correction during the FaceControls/affect work: I committed the T1
role-transcript slice right after green tests ("commit plus je veux tester
avant c'est moi qui fait ca stp").

Rule: green BDD + tsc is necessary but NOT sufficient for history. The
acceptance step is Jeremie verifying live in-app. My stopping point is a
clean working tree + test report + "ready for your test". No git commit,
no push, ever — not even "one commit per task" from an approved plan.

## 2026-06-12 — Always-on tools invalidate every BDD literal on tool lists

Adding set_affect to EVERY session via toolsForRequest broke two
unrelated-looking gates one after the other: prompt-compiler-port
(instructions literal "...create_summary" missing ",set_affect") then
provider-factory (tools.length === 0 fixture now 1). Two full
audit:solid cycles burned because I fixed one stale expectation, reran,
hit the next.
- Before rerunning a 2-min fail-fast gate after a toolset/protocol
  change, grep the whole BDD surface for the invariant that changed
  (tools.length, toolNames, instruction literals) and fix ALL stale
  expectations in one pass.
- A tool schema is a contract with the model: if a param is documented
  "Default to 0.6", the coercion layer must implement that default.
  Gemini live really does omit optional params (live session showed
  smile/intensity 0 — invisible). Write the omitted-param BDD scenario
  the moment a schema declares a default.

## 2026-06-12 — "Nothing animates" after a file move: check browser console FIRST

Jeremie reported mouth/expression frozen in live test right after the
face-* modules were restructured into face/. I traced the whole data
flow statically (UI props, SDK client, rig, shader, geometry masks —
all sound) before reading the console, which held the answer in one
line: Vite HMR 404s on the old module paths, VoiceOrb/HologramBust
"Failed to reload" — the open page was running a stale half-bundle, the
rig never ran. A hard refresh fixed it.
- For any "X stopped working in the browser" report that follows a file
  rename/move/restructure: read console messages (HMR reload failures,
  404s) BEFORE tracing code. 30 seconds vs 15 minutes.
- Vite keeps serving the stale graph after failed HMR; behavior bugs
  observed on such a page are not evidence about the current code.

## 2026-06-12 — Adding a required snapshot field: grep ALL literal constructors

Adding `outputBands` to BrowserVoiceSessionSnapshot broke the starter
typecheck at the gate (config.ts had its own `initialSnapshot` literal).
The core INITIAL_SNAPSHOT was not the only constructor of that type.
- After adding a required field to a public interface, grep the whole
  workspace for other object literals typed against it (`: TypeName =`)
  BEFORE running the 2-minute gate.
