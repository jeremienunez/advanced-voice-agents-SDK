import type { InfraComputeTarget } from "@voiceagentsdk/core/sdk";
import { normalizeToken } from "./infra-token.js";

export function normalizeComputeTarget(
  value: string | undefined,
): InfraComputeTarget {
  const normalized = normalizeToken(value);
  if (normalized === "vm") return "vm";
  if (normalized === "k3" || normalized === "k3s") return "k3s";
  if (normalized === "k8s" || normalized === "kubernetes") return "kubernetes";
  if (normalized === "managed") return "managed";
  return "local";
}
