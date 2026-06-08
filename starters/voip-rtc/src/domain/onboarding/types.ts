export type OnboardingEnvGroup =
  | "voice"
  | "builder"
  | "infra"
  | "knowledge"
  | "auth";

export type DependencyStatus = "ok" | "missing" | "blocked" | "optional";

export interface OnboardingEnvField {
  name: string;
  group: OnboardingEnvGroup;
  label: string;
  description: string;
  configured: boolean;
  source: "process" | "local" | "starter" | "root" | "missing";
  secret?: boolean;
  options?: string[];
  defaultValue?: string;
  restartRequired?: boolean;
  value?: string;
  maskedValue?: string;
}

export interface OnboardingEnvStore {
  store: {
    format: string;
    path: string;
    restartRequired: boolean;
  };
  fields: OnboardingEnvField[];
  requirements: OnboardingRequirement[];
}

export interface OnboardingRequirement {
  id: string;
  group: OnboardingEnvGroup;
  label: string;
  message: string;
  satisfied: boolean;
  severity: "required" | "recommended";
  candidateKeys: string[];
  mode: "any" | "all";
}

export interface OnboardingDependency {
  id: string;
  label: string;
  status: DependencyStatus;
  required: boolean;
  detail: string;
  command: string;
  docsUrl: string;
}

export interface OnboardingState {
  env: OnboardingEnvStore;
  dependencies: OnboardingDependency[];
}

export type InfraAction = "plan" | "apply" | "status" | "destroy";

export interface InfraActionResult {
  ok: boolean;
  action: InfraAction;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  parsed?: unknown;
}
