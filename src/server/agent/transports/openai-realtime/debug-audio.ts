import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import type { AgentLogger } from "../../utils/logger.js";

export interface OpenAIDebugAudioDump {
  directory: string;
  inputPath: string;
  outputPath: string;
  inputWavPath: string;
  outputWavPath: string;
  appendInput(chunk: Buffer): void;
  appendOutput(chunk: Buffer): void;
  finalize(): void;
  cleanup(): void;
}

const localDebugMode = "local";

export function createOpenAIDebugAudioDump(
  logger: AgentLogger,
): OpenAIDebugAudioDump | null {
  if (!process.env.VOICE_DEBUG_AUDIO) return null;

  if (process.env.NODE_ENV === "production") {
    logger.warn("VOICE_DEBUG_AUDIO ignored in production");
    return null;
  }

  if (process.env.VOICE_DEBUG_AUDIO !== localDebugMode) {
    logger.warn("VOICE_DEBUG_AUDIO ignored unless set to local");
    return null;
  }

  const root = resolveDebugRoot();
  if (!root) {
    logger.warn("VOICE_DEBUG_AUDIO_DIR must be under cwd or system temp");
    return null;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const debugDir = join(root, ts);
  mkdirSync(debugDir, { mode: 0o700, recursive: true });
  chmodSync(debugDir, 0o700);
  const inputPath = join(debugDir, "input.pcm");
  const outputPath = join(debugDir, "output.pcm");
  const inputWavPath = join(debugDir, "input.wav");
  const outputWavPath = join(debugDir, "output.wav");
  logger.info("Audio debug dump enabled", { debugDirectory: debugDir });

  return {
    directory: debugDir,
    inputPath,
    outputPath,
    inputWavPath,
    outputWavPath,
    appendInput: (chunk) => appendRestricted(inputPath, chunk),
    appendOutput: (chunk) => appendRestricted(outputPath, chunk),
    finalize: () => {
      for (const [path, wavPath] of [
        [inputPath, inputWavPath],
        [outputPath, outputWavPath],
      ]) {
        try {
          const pcm = readFileSync(path);
          if (pcm.length > 0) {
            const wav = pcmToWav(pcm, 24000);
            writeRestricted(wavPath, wav);
            logger.info("Audio debug WAV written", {
              debugFile: wavPath,
              kilobytes: Math.round(wav.length / 1024),
            });
          }
        } catch {
          /* ignore */
        }
      }
    },
    cleanup: () => rmSync(debugDir, { recursive: true, force: true }),
  };
}

function resolveDebugRoot(): string | null {
  const root = resolve(
    process.env.VOICE_DEBUG_AUDIO_DIR ?? join(tmpdir(), "voice-debug"),
  );
  return isLocalPath(root) ? root : null;
}

function isLocalPath(path: string): boolean {
  return isPathInside(path, tmpdir()) || isPathInside(path, process.cwd());
}

function isPathInside(path: string, parent: string): boolean {
  const resolvedParent = resolve(parent);
  const distance = relative(resolvedParent, path);
  return (
    distance === "" ||
    Boolean(distance && !distance.startsWith("..") && !isAbsolute(distance))
  );
}

function appendRestricted(path: string, chunk: Buffer): void {
  appendFileSync(path, chunk, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function writeRestricted(path: string, value: Buffer): void {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
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
