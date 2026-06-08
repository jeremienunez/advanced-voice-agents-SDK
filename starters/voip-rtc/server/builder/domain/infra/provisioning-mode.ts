import type { InfraProvisioningMode } from "@voiceagentsdk/core/sdk";
import { normalizeToken } from "./token.js";

export function normalizeProvisioningMode(
  value: string | undefined,
): InfraProvisioningMode {
  const normalized = normalizeToken(value);
  if (normalized === "manual") return "manual";
  if (normalized === "iac" || normalized === "iac_plan") return "iac_plan";
  if (normalized === "external") return "external";
  return "server_template";
}
