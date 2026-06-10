import {
  buildFaceGeometry,
  bustDistance,
  hairMask,
  mouthMask,
  OrbSeededRng,
} from "../../../src/components/hologram/face-geometry.js";
import { blinkAmount, gazeTarget, moodExpression } from "../../../src/components/hologram/holo-motion.js";

const results = [
  scenarioGeometryIsSeedStable(),
  scenarioLatticeIsOrderedTopToBottom(),
  scenarioPointsLieOnTheSculptedSurface(),
  scenarioAnatomicalMasksAreCoherent(),
  scenarioFaceReliefAndIrisesArePresent(),
  scenarioGazeIsCenteredAndClamped(),
  scenarioBlinkIsPeriodicAndBounded(),
  scenarioMoodExpressionsAreDistinctAndBounded(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioGazeIsCenteredAndClamped(): string {
  const rect = { left: 100, top: 100, width: 400, height: 400 };

  const center = gazeTarget(300, 300, rect);
  assert(Math.abs(center.x) < 1e-9 && Math.abs(center.y) < 1e-9, "pointer at center must give a neutral gaze");

  const right = gazeTarget(500, 300, rect);
  assert(right.x > 0.9 && Math.abs(right.y) < 1e-9, "pointer at the right edge must look fully right");

  const above = gazeTarget(300, 100, rect);
  assert(above.y > 0.9, "pointer at the top edge must look fully up");

  const farAway = gazeTarget(5000, -5000, rect);
  assert(
    farAway.x <= 1 && farAway.x >= -1 && farAway.y <= 1 && farAway.y >= -1,
    "gaze must stay clamped when the pointer leaves the stage",
  );

  return "gaze-is-centered-and-clamped";
}

function scenarioMoodExpressionsAreDistinctAndBounded(): string {
  const idle = moodExpression(0);
  const listening = moodExpression(1);
  const speaking = moodExpression(2);
  const muted = moodExpression(3);

  for (const e of [idle, listening, speaking, muted]) {
    for (const v of [e.smile, e.widen, e.bow, e.tilt]) {
      assert(v >= -1 && v <= 1, `expression channels must stay in [-1,1], got ${v}`);
    }
  }
  assert(idle.smile === 0 && idle.bow === 0 && idle.tilt === 0, "idle must be the neutral pose");
  assert(speaking.smile > 0.3, "speaking must carry a smile");
  assert(listening.widen > 0.3, "listening must widen the eyes");
  assert(listening.tilt !== 0, "listening must tilt the head, attentive");
  assert(muted.bow > 0.3, "muted must bow the head");
  assert(muted.smile < 0, "muted must drop the mouth corners");

  return "mood-expressions-distinct-and-bounded";
}

function scenarioBlinkIsPeriodicAndBounded(): string {
  for (let t = 0; t < 9600; t += 16) {
    const blink = blinkAmount(t);
    assert(blink >= 0 && blink <= 1, `blink must stay in [0,1], got ${blink} at ${t}ms`);
    assert(Math.abs(blink - blinkAmount(t + 4600)) < 1e-9, "blink must repeat every period");
  }
  assert(blinkAmount(70) > 0.9, "the lid must close during the first pulse");
  assert(blinkAmount(2000) === 0, "eyes must rest open between pulses");

  return "blink-is-periodic-and-bounded";
}

function scenarioGeometryIsSeedStable(): string {
  const first = buildFaceGeometry(new OrbSeededRng(1337), 4000);
  const second = buildFaceGeometry(new OrbSeededRng(1337), 4000);
  const other = buildFaceGeometry(new OrbSeededRng(99), 4000);

  assert(first.count === second.count, "same seed must produce the same point count");
  assert(
    checksum(first.positions) === checksum(second.positions),
    "same seed must sculpt the same bust",
  );
  assert(
    checksum(first.positions) !== checksum(other.positions),
    "different seeds must sculpt different clouds",
  );
  assert(first.count >= 3800, `sampling must come close to budget, got ${first.count}`);

  return "geometry-seed-stable";
}

function scenarioLatticeIsOrderedTopToBottom(): string {
  const geometry = buildFaceGeometry(new OrbSeededRng(1337), 4000);
  /* the lattice is rings x segments: the cloud must descend in order */
  const slice = Math.floor(geometry.count / 8);
  const avgY = (from: number): number => {
    let sum = 0;
    for (let i = from; i < from + slice; i++) sum += geometry.positions[i * 3 + 1];
    return sum / slice;
  };
  const top = avgY(0);
  const middle = avgY(slice * 3);
  const bottom = avgY(geometry.count - slice);
  assert(top > middle && middle > bottom, "lattice rows must descend from crown to neck");
  assert(top > 0.5, `the first rings must sit on the crown, got ${top.toFixed(2)}`);
  assert(bottom < -0.6, `the last rings must reach the neck, got ${bottom.toFixed(2)}`);

  return "lattice-is-ordered-top-to-bottom";
}

function scenarioPointsLieOnTheSculptedSurface(): string {
  const geometry = buildFaceGeometry(new OrbSeededRng(1337), 4000);
  let offSurface = 0;

  for (let i = 0; i < geometry.count; i++) {
    const p: [number, number, number] = [
      geometry.positions[i * 3],
      geometry.positions[i * 3 + 1],
      geometry.positions[i * 3 + 2],
    ];
    if (Math.abs(bustDistance(p)) > 0.02) offSurface += 1;
  }

  assert(geometry.count > 2000, "the lattice must dominate the cloud");
  assert(
    offSurface / geometry.count < 0.01,
    `lattice points must sit on the SDF surface (${offSurface}/${geometry.count} off)`,
  );

  return "points-lie-on-sculpted-surface";
}

function scenarioAnatomicalMasksAreCoherent(): string {
  const lipsPoint: [number, number, number] = [0, -0.4, 0.55];
  const foreheadPoint: [number, number, number] = [0, 0.45, 0.55];
  assert(
    mouthMask(lipsPoint) > 0.5,
    "the mouth mask must be strong on the lips",
  );
  assert(
    mouthMask(foreheadPoint) < 0.05,
    "the mouth mask must vanish on the forehead",
  );

  const backOfSkull: [number, number, number] = [0, 0.4, -0.7];
  const chin: [number, number, number] = [0, -0.6, 0.4];
  const shoulder: [number, number, number] = [0.8, -1.6, 0];
  assert(hairMask(backOfSkull) > 0.6, "the back of the skull must read as hair");
  assert(hairMask(chin) < 0.1, "the chin must never read as hair");
  assert(hairMask(shoulder) === 0, "the bust must never read as hair");

  return "anatomical-masks-coherent";
}

function scenarioFaceReliefAndIrisesArePresent(): string {
  const geometry = buildFaceGeometry(new OrbSeededRng(1337), 4000);
  let irises = 0;
  let faded = 0;
  const socketShades: number[] = [];
  const foreheadShades: number[] = [];

  for (let i = 0; i < geometry.count; i++) {
    const x = geometry.positions[i * 3];
    const y = geometry.positions[i * 3 + 1];
    const z = geometry.positions[i * 3 + 2];
    const shade = geometry.aux2[i * 4 + 1];
    if (geometry.aux2[i * 4 + 3] > 0) irises += 1;
    const bust = geometry.aux2[i * 4 + 2];
    assert(bust >= 0 && bust <= 1, "bust fade must stay in [0,1]");
    if (bust < 0.5) faded += 1;
    if (Math.hypot(Math.abs(x) - 0.2, y - 0.12) < 0.05 && z > 0.35) socketShades.push(shade);
    if (Math.abs(x) < 0.2 && y > 0.35 && y < 0.55 && z > 0.35) foreheadShades.push(shade);
  }

  const avg = (arr: number[]): number => arr.reduce((a, b) => a + b, 0) / arr.length;
  assert(socketShades.length > 4 && foreheadShades.length > 4, "sockets and forehead must be sampled");
  assert(
    avg(socketShades) < avg(foreheadShades) * 0.6,
    `the sockets must sleep darker than the forehead (${avg(socketShades).toFixed(2)} vs ${avg(foreheadShades).toFixed(2)})`,
  );
  assert(irises > 2 && irises < 60, `the irises must be a small lit cluster, got ${irises}`);
  assert(faded > 20, "the base of the neck must fade like a projection");

  return "face-relief-and-irises-present";
}

function checksum(values: Float32Array): number {
  let hash = 0;
  const sample = Math.min(values.length, 1200);
  for (let i = 0; i < sample; i++) {
    hash = (Math.imul(hash, 31) + Math.round(values[i] * 1e4)) | 0;
  }
  return hash;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
