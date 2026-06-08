import { appendFileSync } from "node:fs";
import type { TelemetryEvent } from "./types.js";

export class Telemetry {
  constructor(
    private readonly runId: string,
    private readonly path: string,
  ) {}

  event(event: Omit<TelemetryEvent, "runId" | "timestamp">): void {
    const nextEvent: TelemetryEvent = {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      ...event,
    };
    appendFileSync(this.path, `${JSON.stringify(nextEvent)}\n`);
  }
}
