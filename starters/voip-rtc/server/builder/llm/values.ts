import type { JsonObject } from "@voiceagentsdk/core/sdk";

export function readNumber(
  record: JsonObject | undefined,
  key: string,
): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
