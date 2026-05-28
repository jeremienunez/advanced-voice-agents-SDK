import type { JsonSchema, JsonValue } from "./json.js";
import type { StoreDefinition } from "./store.js";

export type AgentChannel = "voice" | "chat" | "sms";
export type ProviderKind =
  | "openai-realtime"
  | "gemini-live"
  | "grok-realtime"
  | "cascaded"
  | "custom";
export type MediaBridgeKind =
  | "twilio-voice"
  | "browser-websocket"
  | "sip"
  | "custom";

export type PlanId = string;
export type ToolName = string;
export type TenantId = string;
export type ProviderId = string;
export type DatabaseResourceId = string;

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

export interface ToolRuntimeContext {
  sessionId: string;
  tenantId: TenantId;
  userId?: string;
  channel: AgentChannel;
  planId?: PlanId;
  services: Record<string, unknown>;
  database?: DomainDataAdapter;
  emit?: (event: RuntimeEvent) => void;
}

export interface RuntimeEvent {
  type: string;
  payload?: unknown;
  timestamp?: number;
}

export interface ToolManifest {
  name: ToolName;
  description: string;
  category?: string;
  parameters: JsonSchema;
  outputSchema?: JsonSchema;
  permissions?: string[];
  requiredSecrets?: SecretRef[];
  handlerRef?: string;
  sideEffect?: "none" | "read" | "write" | "external_action" | "handoff";
  allowedPlans?: PlanId[];
  executionMode?: "automatic" | "confirmation" | "explicit";
  voicePreamble?: string;
  maxCallsPerSession?: number;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown>
  extends ToolManifest {
  execute: (input: TInput, context: ToolRuntimeContext) => Promise<TOutput>;
  format?: (output: TOutput, channel: AgentChannel) => string;
  keyFacts?: (output: TOutput) => string[];
}

export interface DatabaseTableDefinition {
  id: DatabaseResourceId;
  description?: string;
  fields?: JsonSchema;
  primaryKey?: string;
  indexes?: string[];
}

export interface DatabaseCollectionDefinition {
  id: DatabaseResourceId;
  description?: string;
  schema?: JsonSchema;
  indexes?: string[];
}

export interface DatabaseVectorIndexDefinition {
  id: DatabaseResourceId;
  dimensions: number;
  metric?: "cosine" | "dot" | "euclidean";
  metadataSchema?: JsonSchema;
}

export interface DatabaseDefinition {
  id: string;
  adapterRef?: string;
  displayName?: string;
  tables: DatabaseTableDefinition[];
  collections: DatabaseCollectionDefinition[];
  vectorIndexes: DatabaseVectorIndexDefinition[];
  kvNamespaces: DatabaseResourceId[];
}

export interface DomainDataAdapter {
  query<T = unknown>(resourceId: DatabaseResourceId, input: unknown): Promise<T>;
  command?<T = unknown>(
    resourceId: DatabaseResourceId,
    input: unknown,
  ): Promise<T>;
}

export interface DomainPack {
  id: string;
  displayName: string;
  description?: string;
  onboarding?: OnboardingStep[];
  prompts?: PromptSection[];
  tools?: ToolManifest[];
  database?: DatabaseDefinition;
  stores?: StoreDefinition[];
  plans?: PlanDefinition[];
  services?: Record<string, unknown>;
}

export interface VoiceAgentSdkDefinition {
  tenants: TenantDefinition[];
  providers: ProviderDefinition[];
  mediaBridges: MediaBridgeDefinition[];
  plans: PlanDefinition[];
  prompts: PromptSection[];
  tools: ToolManifest[];
  databases: DatabaseDefinition[];
  stores: StoreDefinition[];
  onboarding: OnboardingStep[];
  packs: DomainPack[];
}
