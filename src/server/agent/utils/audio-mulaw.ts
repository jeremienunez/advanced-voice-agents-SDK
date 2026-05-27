const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

const MULAW_DECODE_TABLE = new Int16Array(256);
for (let index = 0; index < 256; index++) {
  const mulaw = ~index & 0xff;
  const sign = mulaw & 0x80;
  const exponent = (mulaw >> 4) & 0x07;
  const mantissa = mulaw & 0x0f;
  let sample = ((mantissa << 4) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  MULAW_DECODE_TABLE[index] = sign ? -sample : sample;
}

export function pcmToMulaw(pcmBuffer: Buffer): Buffer {
  const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    mulawBuffer[i] = linearToMulaw(sample);
  }

  return mulawBuffer;
}

export function mulawToPcm(mulawBuffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = mulawToLinear(mulawBuffer[i]);
    pcmBuffer.writeInt16LE(sample, i * 2);
  }

  return pcmBuffer;
}

function linearToMulaw(pcm: number): number {
  const sign = pcm < 0 ? 0x80 : 0;
  let magnitude = Math.abs(pcm);
  if (magnitude > MULAW_CLIP) magnitude = MULAW_CLIP;
  magnitude += MULAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; exponent > 0; expMask >>= 1, exponent--) {
    if (magnitude & expMask) break;
  }

  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function mulawToLinear(mulawByte: number): number {
  return MULAW_DECODE_TABLE[mulawByte & 0xff];
}
