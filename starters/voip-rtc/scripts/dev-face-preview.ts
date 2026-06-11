/* Scratch tool: renders the procedural bust to PNG so the sculpt can be
   judged on image during development. Mirrors the idle vertex math. */
import { deflateSync } from "node:zlib";
import { buildFaceGeometry, OrbSeededRng } from "../src/components/hologram/face-geometry.js";

const W = 540;
const H = 620;
const geo = buildFaceGeometry(new OrbSeededRng(1337), 30000);
const buf = new Float32Array(W * H * 3);

const yawDeg = Number(process.argv[2] ?? 0);
const yaw = (yawDeg * Math.PI) / 180;
const cy = Math.cos(yaw);
const sy = Math.sin(yaw);

for (let i = 0; i < geo.count; i++) {
  let x = geo.positions[i * 3];
  let y = geo.positions[i * 3 + 1];
  let z = geo.positions[i * 3 + 2];
  const [, , warm] = [geo.aux[i * 4], geo.aux[i * 4 + 1], geo.aux[i * 4 + 2]];
  const rnd = geo.aux[i * 4 + 3];
  const eye = geo.aux2[i * 4];
  const shade = geo.aux2[i * 4 + 1];
  const bust = geo.aux2[i * 4 + 2];
  const iris = geo.aux2[i * 4 + 3];

  /* idle pose: scale, lift, yaw — like the shader with time frozen */
  x *= 0.95; y = y * 0.95 + 0.1; z *= 0.95;
  const xr = x * cy + z * sy;
  const zr = -x * sy + z * cy;
  x = xr; z = zr;

  const zoom = Number(process.argv[4] ?? 1);
  const qz = z - 3.1; /* mirrors the shader camera */
  const persp = (2.25 / -qz) * zoom;
  const sx = x * persp;
  const syc = (y - 0.06 * zoom) * persp;
  const px = Math.round((sx * (H / W) * 0.5 + 0.5) * W);
  const py = Math.round((1 - (syc * 0.5 + 0.5)) * H);
  if (px < 0 || px >= W || py < 0 || py >= H) continue;

  /* diagnostic mode: paint the raw shade channel, full alpha */
  if (process.argv[5] === "shade") {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const qx = px + dx; const qy = py + dy;
        if (qx >= W || qy >= H) continue;
        const v = (0.06 + shade * 0.94) * (dx === 0 && dy === 0 ? 1 : 0.6);
        const idx = (qy * W + qx) * 3;
        buf[idx] += v; buf[idx + 1] += v; buf[idx + 2] += v;
      }
    }
    continue;
  }

  /* shader palette, idle */
  void eye;
  const t = 0.3 + 0.4 * rnd;
  let r = 0.55 + (0.62 - 0.55) * t;
  let g = 0.85 + (0.56 - 0.85) * t;
  let b = 1.0;
  const wf = warm * 0.55;
  r = r + (1.0 - r) * wf; g = g + (0.74 - g) * wf; b = b + (0.6 - b) * wf;
  r = r + (0.55 - r) * iris; g = g + (0.95 - g) * iris; b = b + (1.0 - b) * iris;
  const lit = 0.12 + 1.25 * shade;
  r *= lit; g *= lit; b *= lit;

  let a = (0.5 + 0.25 * 0.85) * 0.69;
  a = Math.max(a, iris * 0.5);
  a *= bust;
  a *= geo.scale[i] < 0.99 ? 0.38 : 1; /* scan-layer density rein-in */

  /* splat 2x2 like a GL point sprite */
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const qx = px + dx; const qy = py + dy;
      if (qx >= W || qy >= H) continue;
      const idx = (qy * W + qx) * 3;
      const f = a * (dx === 0 && dy === 0 ? 1 : 0.45);
      buf[idx] += r * f; buf[idx + 1] += g * f; buf[idx + 2] += b * f;
    }
  }
}

/* tone map + encode */
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const s = (y * W + x) * 3;
    const d = y * (W * 3 + 1) + 1 + x * 3;
    raw[d] = Math.min(255, Math.round((1 - Math.exp(-buf[s] * 4.4)) * 290) + 6);
    raw[d + 1] = Math.min(255, Math.round((1 - Math.exp(-buf[s + 1] * 4.4)) * 290) + 8);
    raw[d + 2] = Math.min(255, Math.round((1 - Math.exp(-buf[s + 2] * 4.4)) * 290) + 16);
  }
}

const out = process.argv[3] ?? "/tmp/face-preview.png";
const chunks: Buffer[] = [];
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; /* 8-bit RGB */
chunks.push(sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)));
await Bun.write(out, Buffer.concat(chunks));
console.log(JSON.stringify({ status: "ok", out, points: geo.count }));

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
