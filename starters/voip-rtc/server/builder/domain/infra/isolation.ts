import type { InfraIsolationMode } from "@voiceagentsdk/core/sdk";
import { normalizeToken } from "./token.js";

export function normalizeIsolation(value: string | undefined): InfraIsolationMode {
  const normalized = normalizeToken(value);
  if (normalized === "shared_cluster") return "shared_cluster";
  if (normalized === "dedicated_database") return "dedicated_database";
  if (normalized === "dedicated_vm") return "dedicated_vm";
  if (normalized === "dedicated_cluster") return "dedicated_cluster";
  return "namespace";
}
