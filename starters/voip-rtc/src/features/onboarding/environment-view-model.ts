import type {
  OnboardingDependency,
  OnboardingEnvGroup,
  OnboardingState,
} from "../../domain/onboarding/types.js";

export type EnvironmentStepId = "requirements" | "env" | "preview" | "verify";

export interface EnvironmentStep {
  id: EnvironmentStepId;
  label: string;
  detail: string;
}

export const environmentSteps: EnvironmentStep[] = [
  {
    id: "requirements",
    label: "Check requirements",
    detail: "Verify local dependencies before editing configuration.",
  },
  {
    id: "env",
    label: "Add environment values",
    detail: "Save allowlisted provider, database, auth, and infra values.",
  },
  {
    id: "preview",
    label: "Preview infrastructure",
    detail: "Run a safe plan before applying local resources.",
  },
  {
    id: "verify",
    label: "Apply and verify",
    detail: "Apply selected local infra and confirm readiness.",
  },
];

export function groupEnvFields(state: OnboardingState | null) {
  const groups = new Map<OnboardingEnvGroup, OnboardingState["env"]["fields"]>();
  for (const field of state?.env.fields ?? []) {
    groups.set(field.group, [...(groups.get(field.group) ?? []), field]);
  }
  return groups;
}

export function requiredDependenciesReady(
  dependencies: OnboardingDependency[],
): boolean {
  return dependencies
    .filter((dependency) => dependency.required)
    .every((dependency) => dependency.status === "ok");
}

export function requiredEnvReady(state: OnboardingState | null): boolean {
  return Boolean(state?.env.requirements
    .filter((requirement) => requirement.severity === "required")
    .every((requirement) => requirement.satisfied));
}

export function configuredEnvCount(state: OnboardingState | null): number {
  return state?.env.fields.filter((field) => field.configured).length ?? 0;
}
