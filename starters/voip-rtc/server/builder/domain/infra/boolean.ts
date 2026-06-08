import { normalizeToken } from "./token.js";

export function normalizeBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  const normalized = normalizeToken(value);
  if (!normalized) return false;
  return !["0", "false", "no", "off", "disabled"].includes(normalized);
}
