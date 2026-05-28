import type { AdapterOwnershipBoundary } from "@voiceagentsdk/core/sdk";

const boundaryRequiredProviders = new Set(["milvus", "graph"]);

export function plannedStarterAdapterBoundary(
  provider: "milvus" | "graph",
): AdapterOwnershipBoundary {
  return {
    owner: "starter",
    binding: "planned_only",
    promotion: "candidate_sdk_package",
    reason: reasonFor(provider),
    promotionCriteria: [
      "published adapter package API is independent of the VOIP RTC starter",
      "contract tests cover configuration, provisioning, retrieval, and failure modes",
      "no runtime code imports starter-only modules",
    ],
  };
}

export function requiresAdapterBoundary(provider: string): boolean {
  return boundaryRequiredProviders.has(provider);
}

function reasonFor(provider: "milvus" | "graph"): string {
  if (provider === "milvus") {
    return "Milvus is planned by the starter until a reusable vector adapter package is promoted.";
  }
  return "External graph backends are planned by the starter until a reusable graph adapter package is promoted.";
}
