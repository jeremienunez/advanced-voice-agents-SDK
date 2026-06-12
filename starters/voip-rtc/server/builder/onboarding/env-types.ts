export type EnvFieldGroup =
  | "voice"
  | "builder"
  | "infra"
  | "knowledge"
  | "auth";

export interface EnvFieldDefinition {
  name: string;
  group: EnvFieldGroup;
  label: string;
  description: string;
  secret?: boolean;
  options?: string[];
  defaultValue?: string;
  restartRequired?: boolean;
}

export interface EnvFieldState extends EnvFieldDefinition {
  configured: boolean;
  source: "process" | "local" | "starter" | "root" | "missing";
  value?: string;
  maskedValue?: string;
}

export interface EnvRequirementState {
  id: string;
  group: EnvFieldGroup;
  label: string;
  message: string;
  satisfied: boolean;
  severity: "required" | "recommended";
  candidateKeys: string[];
  mode: "any" | "all";
}
