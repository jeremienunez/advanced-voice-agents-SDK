# face-scan — photo-driven hologram head pipeline

Turns reference photos (front / right profile / back) into the committed
point-cloud asset `src/components/hologram/face/scan.ts` rendered by the
RTC hologram. Everything is computed from the images — no hand-traced
geometry anywhere.

## Inputs

`ref/` (gitignored — subject photos never enter git):

- `front.png`, `profile-right.png`, `profile-left.png`, `back.png` —
  cropped from the reference composite with ImageMagick (`convert
  <composite> -crop WxH+X+Y +repage <view>.png`).

## Step 1 — extraction in Chrome

```bash
bun scripts/face-scan/serve.ts          # static server on :4799
# open http://localhost:4799/ in Chrome (or drive it with Playwright),
# wait for document.title === "SCAN_DONE", then save the result:
#   copy(JSON.stringify(window.__SCAN))  → scripts/face-scan/scan-raw.json
```

`extract.html` computes, in-browser (MediaPipe tasks-vision via CDN):

- **FaceLandmarker** on `front.png` → 478 3D landmarks (x, y px; z in
  MediaPipe's relative depth, x-normalized).
- **Face densification**: jittered hex grid inside the FACE_OVAL polygon
  (~16.8k samples), depth per sample by inverse-distance weighting of
  the 6 nearest landmarks (power 2), luminance per sample from a 5×5
  pixel average.
- **ImageSegmenter** (selfie model) on the three views → person/backdrop
  confidence masks → per-row silhouette chains (the mask run containing
  the head's center column, so studio props and the blurred second
  person never pollute the contour). ~300 rows per view.
- **Luminance maps**: downsampled grayscale of each view's head bbox for
  triplanar sampling at pack time.

Sanity-check the chains before packing — plot them over the photos
(PIL/ImageDraw) and look. If a chain hugs anything that is not the
subject, fix extraction before going further.

## Step 2 — packing

```bash
Z_GAIN=0.9 bun scripts/face-scan/pack-face-scan.ts
```

Emits `src/components/hologram/face/scan.ts` (quantized: positions
Int16 / `POS_SCALE`, shade Uint8, base64).

**Face layer** — registration onto the shader's facial frame:

- roll from the iris line; `sx = 0.4 / interocular` (iris centers land
  on ±0.2, 0.12); `sy = 0.465 / (eye→mouth)` (mouth lands on 0, −0.345).
  These anchors are load-bearing: blink, murmur and mood expressions in
  `holo-shaders.ts` are hard-coded against them.
- depth `z = Z_EYE + (z_eye − z_lm) · sy · Z_GAIN`; neighborhood
  z-smoothing (r 0.035, 2 passes); z clamped under the segmented profile
  silhouette (MediaPipe depth bulges at the oval rim — the photo wins);
  oval boundary seam-blended onto the hull cross-section ellipse.
- shade = luminance, percentile-normalized (p5→0.04, p95→1).

**Skull/bust layer** — two-view visual hull, photo-textured:

- per row y, the cross-section spans the front silhouette (x extent) and
  the profile silhouette (z extent), as a **superellipse** (exponent 2
  at the head easing to 3.7 on the torso — the true two-view hull).
- points placed at constant arc length along the section; row spacing
  adapts to the silhouette slope (shoulders stay a shell, not plates).
- per point, luminance is sampled **triplanar**: front / profile / back
  view weighted by the facing direction (profile mirrored for x<0),
  same percentile mapping as the face, floor 0.13 so dark hair stays
  legible. Side registration: scale from crown→chin height, anchors on
  the crown top and the scan's nose-tip depth. Back registration: scale
  from head-width match, mirrored x.
- the face window (shrunk oval) is culled — the scan layer owns it; the
  band from mid-face to under the chin keeps no front ring points: the
  chin occludes the throat in the profile photo, so the hull has no
  real data there (honest shadow, never invented geometry).
- rings stop at −1.25; mirror plane and stage floor sit at −1.28
  (`holo-shaders.ts` + `rtc-stage-props.ts` — their GLSL cameras must
  stay identical: z 3.1, factor 2.25).

## Step 3 — verification

```bash
bun scripts/dev-face-preview.ts 0    /tmp/front.png   # also ±30, ±90, 180
bun scripts/tests/bdd/test-voice-orb-geometry-bdd.ts
pnpm exec tsc --noEmit -p .
```

Compare the previews against `ref/` crops (montage with `convert
+append`), then check the live stage at `http://localhost:5177/?mode=rtc`
— additive blending + bloom change how density reads, so the browser is
the final judge.
