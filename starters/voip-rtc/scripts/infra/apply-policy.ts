import type { InfraComputeTarget } from "@voiceagentsdk/core/sdk";
import type { InfraApplyDriver } from "./runtime.js";

export type InfraApplyPath = "dev-local" | "external" | "kubernetes";

export interface InfraApplyPolicyInput {
  driver: InfraApplyDriver;
  target: InfraComputeTarget;
}

export function chooseInfraApplyPath(input: InfraApplyPolicyInput): InfraApplyPath {
  if (input.driver === "dev-local") return devLocalPath(input.target);
  if (input.driver === "external") return externalPath(input.target);
  return kubernetesPath(input.target);
}

function devLocalPath(target: InfraComputeTarget): InfraApplyPath {
  if (target !== "local") {
    throw new Error(`dev-local can only apply local plans. Got "${target}".`);
  }
  return "dev-local";
}

function externalPath(target: InfraComputeTarget): InfraApplyPath {
  if (target === "local") {
    throw new Error("External infra runner cannot apply local targets");
  }
  return "external";
}

function kubernetesPath(target: InfraComputeTarget): InfraApplyPath {
  if (target !== "k3s" && target !== "kubernetes") {
    throw new Error(`Apply needs a Kubernetes target. Got "${target}".`);
  }
  return "kubernetes";
}
