export function encodeAudioBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function decodeAudioBase64(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}
