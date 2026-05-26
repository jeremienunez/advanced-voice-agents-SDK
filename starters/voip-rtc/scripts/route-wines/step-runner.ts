import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { summarizeStepResult, slugify } from "./records.js";
import type { Telemetry } from "./telemetry.js";

export class StepRunner {
  private stepCounter = 0;

  constructor(
    private readonly telemetry: Telemetry,
    private readonly artifactsDir: string,
  ) {}

  async run<T>(name: string, task: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    this.telemetry.event({ type: "step.start", name });
    try {
      const result = await task();
      const artifactPath = this.writeArtifact(name, result);
      this.telemetry.event({
        type: "step.end",
        name,
        status: "ok",
        durationMs: Math.round(performance.now() - startedAt),
        data: {
          ...summarizeStepResult(result),
          artifactPath,
        },
      });
      return result;
    } catch (error) {
      this.telemetry.event({
        type: "step.end",
        name,
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private writeArtifact(name: string, value: unknown): string {
    this.stepCounter += 1;
    const artifactPath = join(
      this.artifactsDir,
      `${String(this.stepCounter).padStart(2, "0")}-${slugify(name)}.json`,
    );
    writeFileSync(artifactPath, `${JSON.stringify(value, null, 2)}\n`);
    return artifactPath;
  }
}
