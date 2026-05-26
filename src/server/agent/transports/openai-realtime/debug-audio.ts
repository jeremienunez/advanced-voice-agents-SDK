import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import type { AgentLogger } from "../../utils/index.js";

export interface OpenAIDebugAudioDump {
  appendInput(chunk: Buffer): void;
  appendOutput(chunk: Buffer): void;
  finalize(): void;
}

export function createOpenAIDebugAudioDump(
  logger: AgentLogger,
): OpenAIDebugAudioDump | null {
  if (!process.env.VOICE_DEBUG_AUDIO) return null;

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const debugDir = join("/tmp/voice-debug", ts);
  mkdirSync(debugDir, { recursive: true });
  const inputPath = join(debugDir, "input.pcm");
  const outputPath = join(debugDir, "output.pcm");
  logger.info(`Audio debug dump -> ${debugDir}`);

  return {
    appendInput: (chunk) => appendFileSync(inputPath, chunk),
    appendOutput: (chunk) => appendFileSync(outputPath, chunk),
    finalize: () => {
      for (const path of [inputPath, outputPath]) {
        try {
          const pcm = readFileSync(path);
          if (pcm.length > 0) {
            const wav = pcmToWav(pcm, 24000);
            const wavPath = path.replace(".pcm", ".wav");
            writeFileSync(wavPath, wav);
            logger.info(
              `WAV written: ${wavPath} (${(wav.length / 1024).toFixed(0)}KB)`,
            );
          }
        } catch {
          /* ignore */
        }
      }
    },
  };
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
