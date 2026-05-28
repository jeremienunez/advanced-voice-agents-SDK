import type {
  AgentChannel,
  MediaBridgeDefinition,
  PlanId,
  ProviderDefinition,
  ProviderId,
  SecretRef,
  TenantId,
  ToolName,
} from "./core.js";

export interface SecretResolveInput {
  ref: SecretRef;
  aliases?: readonly string[];
  purpose?: string;
  metadata?: Record<string, unknown>;
}

export interface SecretResolverPort {
  resolveSecret(input: SecretResolveInput): string | undefined;
}

export interface ProviderFactoryInput<TTool = unknown> {
  definition: ProviderDefinition;
  requestedModel?: string;
  requestedVoice?: string;
  instructions: string;
  tools: readonly TTool[];
  metadata?: Record<string, unknown>;
}

export interface ProviderFactoryPort<TProvider = unknown, TTool = unknown> {
  createProvider(input: ProviderFactoryInput<TTool>): TProvider;
}

export interface RuntimePromptCompileInput {
  channel: AgentChannel;
  providerId: ProviderId;
  agentId?: string;
  tenant: TenantResolutionResult;
  toolNames: readonly ToolName[];
}

export interface PromptCompilerPort {
  compilePrompt(
    input: RuntimePromptCompileInput,
  ): string | Promise<string>;
}

export interface RuntimeEventRecord {
  type: string;
  timestamp?: number;
  payload?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EventSinkPort<TEvent = RuntimeEventRecord> {
  emit(event: TEvent): void | Promise<void>;
}

export type RuntimeLogContext = Record<string, unknown>;

export interface LoggerPort {
  debug(message: string, context?: RuntimeLogContext): void;
  info(message: string, context?: RuntimeLogContext): void;
  warn(message: string, context?: RuntimeLogContext): void;
  error(message: string, context?: RuntimeLogContext): void;
  child(context: RuntimeLogContext): LoggerPort;
}

export interface MediaBridgeFactoryInput<TOptions = unknown> {
  definition: MediaBridgeDefinition;
  browserSampleRate?: number;
  llmInputSampleRate?: number;
  options?: TOptions;
  metadata?: Record<string, unknown>;
}

export interface MediaBridgePort<
  TInboundAudio = unknown,
  TOutboundAudio = unknown,
  TLlmAudio = unknown,
> {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
  ingestAudio(audio: TInboundAudio): void | Promise<void>;
  sendAudio(audio: TOutboundAudio): void | Promise<void>;
  clearOutput(): void | Promise<void>;
  onAudioToLlm(handler: (audio: TLlmAudio) => void): void;
}

export interface MediaBridgeFactoryPort<
  TBridge = MediaBridgePort,
  TOptions = unknown,
> {
  createMediaBridge(input: MediaBridgeFactoryInput<TOptions>): TBridge;
}

export interface TenantResolutionInput {
  channel: AgentChannel;
  provider?: string;
  from?: string;
  to?: string;
  callId?: string;
  accountId?: string;
}

export interface TenantResolutionResult {
  tenantId: TenantId;
  providerId: ProviderId;
  mediaBridgeId: string;
  planId: PlanId;
  userId?: string;
  limits?: Record<string, number>;
  promptVariables?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
}

export interface TenantResolverPort {
  resolveTenant(input: TenantResolutionInput): TenantResolutionResult;
}
