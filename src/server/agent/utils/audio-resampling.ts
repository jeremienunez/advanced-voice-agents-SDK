export function resamplePcm16(
  buffer: Buffer,
  fromSampleRate: number,
  toSampleRate: number,
): Buffer {
  if (fromSampleRate === toSampleRate) return buffer;
  if (fromSampleRate <= 0 || toSampleRate <= 0) {
    throw new Error("Sample rates must be positive");
  }

  const inputSamples = Math.floor(buffer.length / 2);
  if (inputSamples === 0) return Buffer.alloc(0);

  const outputSamples = Math.max(
    1,
    Math.floor((inputSamples * toSampleRate) / fromSampleRate),
  );
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const sourceIndex = (i * fromSampleRate) / toSampleRate;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(inputSamples - 1, leftIndex + 1);
    const weight = sourceIndex - leftIndex;
    const left = buffer.readInt16LE(leftIndex * 2);
    const right = buffer.readInt16LE(rightIndex * 2);
    const sample = Math.round(left + (right - left) * weight);
    output.writeInt16LE(clampPcm16(sample), i * 2);
  }

  return output;
}

function clampPcm16(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}
