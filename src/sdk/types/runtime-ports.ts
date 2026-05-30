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

export interface MemoryScope {
  tenantId: TenantId;
  userId?: string;
  sessionId?: string;
  agentId?: string;
}

export interface MemoryRecord {
  id: string;
  scope: MemoryScope;
  kind: string;
  value: unknown;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStoreWriteInput {
  scope: MemoryScope;
  kind: string;
  value: unknown;
  id?: string;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryStoreListInput {
  scope: MemoryScope;
  kind?: string;
  limit?: number;
}

export interface MemoryStoreDeleteInput {
  id?: string;
  scope?: MemoryScope;
  kind?: string;
}

export interface MemoryStorePort {
  isConfigured?(): boolean;
  ensure?(): void | Promise<void>;
  write(input: MemoryStoreWriteInput): MemoryRecord | Promise<MemoryRecord>;
  list(input: MemoryStoreListInput): readonly MemoryRecord[] | Promise<readonly MemoryRecord[]>;
  delete?(input: MemoryStoreDeleteInput): number | Promise<number>;
}

export interface RuntimePromptCompileInput {
  channel: AgentChannel;
  providerId: ProviderId;
  agentId?: string;
  tenant: TenantResolutionResult;
  toolNames: readonly ToolName[];
  memories?: readonly MemoryRecord[];
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

export type PendingActionStatus =
  | "confirmation_required"
  | "approved"
  | "rejected"
  | "expired";

export interface PendingActionCreateInput {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  providerId?: string;
  toolName: string;
  arguments: Record<string, unknown>;
  sideEffect?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PendingActionRecord extends PendingActionCreateInput {
  id: string;
  status: PendingActionStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface PendingActionResolveInput {
  id: string;
  status: Extract<PendingActionStatus, "approved" | "rejected" | "expired">;
  reason?: string;
}

export interface PendingActionPort {
  create(
    input: PendingActionCreateInput,
  ): PendingActionRecord | Promise<PendingActionRecord>;
  get?(id: string): PendingActionRecord | null | Promise<PendingActionRecord | null>;
  resolve?(
    input: PendingActionResolveInput,
  ): PendingActionRecord | Promise<PendingActionRecord>;
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
