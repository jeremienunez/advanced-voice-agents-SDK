import type { JsonValue } from "../json.js";
import type {
  AgentChannel,
  MediaBridgeKind,
  PlanId,
  ProviderId,
  ProviderKind,
  TenantId,
} from "./ids.js";

export interface SecretRef {
  name: string;
  optional?: boolean;
}

export interface ProviderDefinition {
  id: ProviderId;
  kind: ProviderKind;
  displayName?: string;
  apiKey?: SecretRef;
  model?: string;
  voice?: string;
  inputSampleRate?: number;
  outputSampleRate?: number;
  options?: Record<string, unknown>;
}

export interface MediaBridgeDefinition {
  id: string;
  kind: MediaBridgeKind;
  providerId?: ProviderId;
  inputEncoding?: string;
  outputEncoding?: string;
  sampleRate?: number;
  options?: Record<string, unknown>;
}

export interface TenantDefinition {
  id: TenantId;
  displayName: string;
  publicDomain?: string;
  defaultProviderId?: ProviderId;
  defaultMediaBridgeId?: string;
  metadata?: Record<string, unknown>;
}

export interface PlanDefinition {
  id: PlanId;
  label: string;
  inherits?: PlanId[];
  limits?: Record<string, number>;
  features?: string[];
}

export interface PromptSection {
  id: string;
  title?: string;
  body: string;
  priority?: number;
  channels?: AgentChannel[];
  variables?: string[];
}

export interface OnboardingField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "multi-select" | "boolean" | "secret";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: JsonValue;
  helpText?: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  fields: OnboardingField[];
}

export interface RuntimeEvent {
  type: string;
  payload?: unknown;
  timestamp?: number;
}
