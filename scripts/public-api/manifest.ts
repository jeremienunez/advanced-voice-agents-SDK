export interface PublicApiPackageExport {
  types: string;
  import: string;
}

export interface PublicApiEntry {
  exportPath: string;
  specifier: string;
  sourceFile: string;
  packageExport: PublicApiPackageExport;
  runtimeProbe: string;
  values: readonly string[];
  types: readonly string[];
  forbiddenValues?: readonly string[];
  forbiddenTypes?: readonly string[];
}

export const publicApiEntries = [
  {
    exportPath: ".",
    specifier: "@voiceagentsdk/core",
    sourceFile: "src/index.ts",
    packageExport: {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
    runtimeProbe: "compileVoiceAgentSdk",
    values: [
      "AgentBuildDraftBuilder", "AgentBuilder", "DatabaseBuilder", "ToolBuilder", "compileVoiceAgentSdk", "createAgentBuildDraftBuilder",
      "createAgentBuilder", "createDatabaseBuilder", "createToolBuilder", "defineDomainPack", "defineToolRegistryItem",
    ],
    types: [
      "CompiledAgentArtifact", "CompiledVoiceAgentSdk", "DomainPack", "PromptBuildPlan", "PromptRenderInput", "ProviderDefinition",
      "TenantDefinition", "ToolDefinition", "ToolRegistryItem", "VoiceAgentSdkDefinition",
    ],
  },
  {
    exportPath: "./sdk",
    specifier: "@voiceagentsdk/core/sdk",
    sourceFile: "src/sdk/index.ts",
    packageExport: {
      types: "./dist/sdk/index.d.ts",
      import: "./dist/sdk/index.js",
    },
    runtimeProbe: "createAgentBuilder",
    values: [
      "AGENTRX_FAILURE_CATEGORIES", "AGENTRX_TAXONOMY_VERSION", "AgentBuildDraftBuilder", "AgentBuilder", "DatabaseBuilder", "StoreBuilder",
      "StoreEntityBuilder", "ToolBuilder", "agentRxStructuralConstraints", "agentRxStructuralViolations", "assertStoreAdapterContract", "compileVoiceAgentSdk",
      "createA2AAgentCard", "createAgentBuildDraftBuilder", "createAgentBuilder", "createAgentLearningLoop", "createAgentRxDiagnosticReport", "createDatabaseBuilder",
      "createDbAdapterRegistry", "createDefaultLearningPolicy", "createDocumentStoreAdapterContract", "createInMemoryLearningRunRepository", "createLearningReceipt", "createNoopEvaluationHarness",
      "createSafeRepository", "createSafeRepositoryFromRegistry", "createSqlStoreAdapterContract", "createStoreAdapterBinding", "createStoreBuilder", "createToolBuilder",
      "createVectorStoreAdapterContract", "defineDomainPack", "defineToolRegistryItem", "extractDefaultSessionLearningSignals", "firstUnrecoveredViolation", "isAgentRxFailureCategory",
      "jsonDefault", "mailboxMessageToA2ATask", "mailboxStatusToA2ATaskState", "normalizeLearningLoopProfile", "publishLearningRunStatus", "renderAgentRxReportMarkdown",
      "resolveDatabaseAdapterFromRegistry", "resolveStoreAdapterBindingFromRegistry", "resolveStoreAdapterFromRegistry", "summarizeAgentRxIterations", "toMcpToolDescriptor", "toMcpToolDescriptors",
    ],
    types: [
      "A2AAgentCapabilities", "A2AAgentCard", "A2AAgentSkill", "A2AArtifact", "A2ABindingKind", "A2ACompatibilityProfile",
      "A2AMessage", "A2APart", "A2AProtocolBinding", "A2ARole", "A2ASupportedInterface", "A2ATask",
      "A2ATaskState", "ActiveAgentAssignmentPort", "ActiveAgentScope", "AdapterBindingMode", "AdapterBoundaryOwner", "AdapterOwnershipBoundary",
      "AdapterPromotionPath", "AgentBuildDraft", "AgentBuildDraftStatus", "AgentBuilderIdentity", "AgentBuilderLlmProvider", "AgentChannel",
      "AgentEvolutionInput", "AgentEvolutionPort", "AgentEvolutionResult", "AgentInfraPlan", "AgentInfraStatus", "AgentLearningGuardrails",
      "AgentLearningLoopOptions", "AgentLearningLoopPort", "AgentLearningPolicyInput", "AgentLearningPolicyPort", "AgentLearningScope", "AgentLearningStoreBackendPlan",
      "AgentLearningStoreCapability", "AgentLearningStoreKind", "AgentMailboxAckInput", "AgentMailboxAddress", "AgentMailboxClaimInput", "AgentMailboxListInput",
      "AgentMailboxMessage", "AgentMailboxMessagePart", "AgentMailboxMessageStatus", "AgentMailboxPort", "AgentMailboxSendInput", "AgentMailboxSubscribeInput",
      "AgentRxConstraint", "AgentRxConstraintType", "AgentRxDiagnosticReport", "AgentRxFailureCategory", "AgentRxIterationSummary", "AgentRxRepeatedActionSummary",
      "AgentRxReportInput", "AgentRxStepStatus", "AgentRxTrajectory", "AgentRxTrajectoryStep", "AgentRxValidationLog", "AgentRxViolation",
      "AgentRxViolationSeverity", "AgentSkillArtifact", "AgentStorePlan", "AuthTicketChannel", "AuthTicketIdentity", "AuthTicketInput",
      "AuthTicketPort", "BrowserVoiceState", "ClientVoiceMessage", "CompiledAgentArtifact", "CompiledVoiceAgentSdk", "CreateA2AAgentCardInput",
      "DatabaseBackendPlan", "DatabaseBackendResolverPort", "DatabaseBuildPlan", "DatabaseBuildRequest", "DatabaseBuildStatus", "DatabaseCollectionDefinition",
      "DatabaseCredentialResolverPort", "DatabaseDefinition", "DatabaseIndexPlan", "DatabasePlannerPort", "DatabaseProvisionInput", "DatabaseProvisionResult",
      "DatabaseProvisionValidation", "DatabaseProvisionerPort", "DatabaseResourceId", "DatabaseSqlStatement", "DatabaseTableDefinition", "DatabaseVectorIndexDefinition",
      "DbAdapterRegistry", "DbAdapterRegistryOptions", "DocumentIngestionInput", "DocumentIngestionOptions", "DocumentIngestionPort", "DomainDataAdapter",
      "DomainPack", "EmbeddingInput", "EmbeddingPort", "EmbeddingVector", "EvaluationHarnessInput", "EvaluationHarnessPort",
      "EvaluationResult", "EventSinkPort", "FinalPromptBuildRequest", "GraphMemoryEdge", "GraphMemoryNode", "GraphMemoryStorePort",
      "GraphMemoryUpsertInput", "InfraComputeTarget", "InfraIacArtifact", "InfraIacArtifactKind", "InfraIacBundle", "InfraIacDialect",
      "InfraIsolationMode", "InfraMigrationPolicy", "InfraPlanRequest", "InfraPlannerPort", "InfraProvisionInput", "InfraProvisionResult",
      "InfraProvisionValidation", "InfraProvisionerPort", "InfraProvisioningMode", "InfraResourceRef", "InfraSecurityPlan", "JsonObject",
      "JsonPrimitive", "JsonSchema", "JsonValue", "KnowledgeBackendCapability", "KnowledgeBackendPlan", "KnowledgeBackendPort",
      "KnowledgeBackendProvider", "KnowledgeBackendResolveResult", "KnowledgeBackendRole", "KnowledgeBuildPlan", "KnowledgeBuildRequest", "KnowledgeChunk",
      "KnowledgeChunkingPlan", "KnowledgeDocument", "KnowledgeDocumentKind", "KnowledgeDocumentStatus", "KnowledgeGraphPlan", "KnowledgeIndexPlan",
      "KnowledgeResearchBudget", "KnowledgeResearchCheckpoint", "KnowledgeResearchCycle", "KnowledgeResearchIntent", "KnowledgeResearchPort", "KnowledgeResearchRequest",
      "KnowledgeResearchResult", "KnowledgeResearchSpend", "KnowledgeSearchInput", "KnowledgeSearchMode", "KnowledgeSearchPort", "KnowledgeSearchResult",
      "KnowledgeSearchResultItem", "KnowledgeSearchScope", "KnowledgeStoreCompileInput", "KnowledgeStoreCompileResult", "KnowledgeStorePort", "KnowledgeStrategy",
      "KnowledgeVerificationRequest", "KnowledgeVerificationVerdict", "KnowledgeVerifierPort", "LearningAuditEvent", "LearningAuditSinkPort", "LearningDelta",
      "LearningDeltaKind", "LearningJobStatus", "LearningLoopEnqueueOptions", "LearningLoopProfile", "LearningMemorySignal", "LearningPromotionScope",
      "LearningPromotionState", "LearningReceipt", "LearningReceiptSinkPort", "LearningRunDecision", "LearningRunRecord", "LearningRunRepositoryPort",
      "LearningRunStatus", "LearningRunStatusUpdate", "LearningSessionInput", "LearningSessionSummary", "LearningStatusSinkPort", "LearningToolCallRecord",
      "LearningTranscriptEntry", "LearningWorkflowDriverPort", "LlmCostNeed", "LlmLatencyNeed", "LlmMessage", "LlmMessageRole",
      "LlmModelCapabilities", "LlmModelProfile", "LlmModelRequest", "LlmModelResolverPort", "LlmOutputContract", "LlmOutputKind",
      "LlmProviderId", "LlmReasoningNeed", "LlmResolvedModel", "LlmTask", "LlmTaskNeeds", "LlmTaskResult",
      "LlmTaskRole", "LlmTaskRunnerPort", "LlmToolCall", "LlmToolNeed", "LlmToolSpec", "LlmUsage",
      "LoggerPort", "McpCompatibilityProfile", "McpToolAnnotations", "McpToolDescriptor", "McpTransportKind", "MediaBridgeDefinition",
      "MediaBridgeFactoryInput", "MediaBridgeFactoryPort", "MediaBridgeKind", "MediaBridgePort", "MemoryRecord", "MemoryScope",
      "MemoryStoreDeleteInput", "MemoryStoreListInput", "MemoryStorePort", "MemoryStoreWriteInput", "OnboardingField", "OnboardingStep",
      "PendingActionCreateInput", "PendingActionPort", "PendingActionRecord", "PendingActionResolveInput", "PendingActionStatus", "PlanDefinition",
      "PlanId", "PromptBuildPlan", "PromptBuildQuestion", "PromptBuildRequest", "PromptCompilerPort", "PromptPlannerPort",
      "PromptRenderInput", "PromptSection", "ProtocolCompatibilityProfile", "ProviderDefinition", "ProviderFactoryInput", "ProviderFactoryPort",
      "ProviderId", "ProviderKind", "RepositoryBuildPlan", "RepositorySafeOperationPlan", "RuntimeDatabaseCredentialRef", "RuntimeEvent",
      "RuntimeEventRecord", "RuntimeLogContext", "RuntimePromptCompileInput", "SafeRepository", "SecretRef", "SecretResolveInput",
      "SecretResolverPort", "ServerVoiceMessage", "SessionLearningExtractorPort", "SessionLearningSignals", "StoreAdapter", "StoreAdapterBinding",
      "StoreAdapterContract", "StoreAdapterContractInput", "StoreAdapterContractKind", "StoreAdapterMigrationPlan", "StoreDefinition", "StoreEntityDefinition",
      "StoreFieldDefinition", "StoreFieldKind", "StoreFieldMapping", "StoreIndexDefinition", "StoreIndexMapping", "StoreOperation",
      "StorePage", "StorePaginationContract", "StorePolicyDefinition", "StoreQuery", "StoreRecordSelector", "StoreRuntimeContext",
      "StoreScopeMode", "StoreSearchDefinition", "StoreSearchQuery", "StoreSoftDeleteContract", "StoreSort", "TemporalMemoryRecord",
      "TemporalMemoryScope", "TemporalMemoryStorePort", "TemporalMemoryWriteInput", "TemporalWorkflowPort", "TenantDefinition", "TenantId",
      "TenantResolutionInput", "TenantResolutionResult", "TenantResolverPort", "ToolBuildContract", "ToolBuildPlan", "ToolBuildRequest",
      "ToolConfirmationPolicy", "ToolDefinition", "ToolManifest", "ToolName", "ToolPlannerPort", "ToolReadiness",
      "ToolRegistryAdapterPort", "ToolRegistryExecutionInput", "ToolRegistryItem", "ToolRegistryRuntimeContext", "ToolRuntimeBinding", "ToolRuntimeContext",
      "ToolSideEffect", "ToolValidationIssue", "ToolValidationReport", "ToolValidationRequest", "VectorizationIndexKind", "VectorizationPlan",
      "VoiceAgentSdkDefinition", "VoiceLearningStatus", "VoiceLearningSummary", "VoiceProvider", "VoiceRecommendation", "VoiceSessionStartOptions",
      "VoiceSessionSummary",
    ],
  },
  {
    exportPath: "./server",
    specifier: "@voiceagentsdk/core/server",
    sourceFile: "src/server/index.ts",
    packageExport: {
      types: "./dist/server/index.d.ts",
      import: "./dist/server/index.js",
    },
    runtimeProbe: "createRealtimeVoiceSession",
    values: [
      "AcousticEchoCanceller", "AgentError", "AudioBuffer", "AudioPipeline", "AutomaticGainControl", "BargeInHandler",
      "BrowserMediaHandler", "BrowserVoiceService", "CascadedRealtimeTransport", "ERROR_CODES", "GEMINI_INPUT_MIME", "GEMINI_INPUT_SAMPLE_RATE",
      "GEMINI_OUTPUT_SAMPLE_RATE", "GROK_DEFAULT_SAMPLE_RATE", "GROK_EVENTS", "GROK_NATIVE_MULAW_FORMAT", "GeminiRealtimeTransport", "GrokRealtimeTransport",
      "InterruptController", "OPENAI_BYTES_PER_SAMPLE", "OPENAI_CHANNELS", "OPENAI_SAMPLE_RATE", "OpenAIChatTransport", "OpenAIRealtimeTransport",
      "RealtimeVoiceSession", "RnnoiseDenoiser", "STATE_METADATA", "STATE_TRANSITIONS", "SessionStateMachine", "ToolExecutionPolicyEngine",
      "TwilioSmsTransport", "TwilioVoiceTransport", "addPendingToolCall", "allowsInput", "allowsOutput", "buildOpenAIRealtimeSessionConfig",
      "calculateAudioDurationMs", "clearAllPendingToolCalls", "clearInterrupted", "createA2AJsonRpcMailboxAdapter", "createA2AMailboxMcpTools", "createA2AMailboxTaskRouter",
      "createAgentMailboxWorker", "createAudioChunk", "createAudioPipeline", "createBargeInHandler", "createBrowserMediaBridgeDefinition", "createBrowserMediaHandler",
      "createBrowserVoiceService", "createCascadedRealtimeTransport", "createConsoleEventSink", "createConsoleLoggerPort", "createDefaultBrowserMediaBridgeFactory", "createEvent",
      "createGeminiRealtimeTransport", "createGrokRealtimeTransport", "createInMemoryAgentMailbox", "createInMemoryMemoryStore", "createInMemoryPendingActionPort", "createInterruptController",
      "createMcpJsonRpcToolAdapter", "createMcpStreamableHttpToolHandler", "createMcpToolRegistryAdapter", "createOpenAIChatTransport", "createOpenAIRealtimeTransport", "createRealtimeVoiceSession",
      "createSessionContext", "createSessionSummary", "createStateMachine", "createTwilioSmsTransport", "createTwilioVoiceTransport", "decodeAudioFromOpenAI",
      "encodeAudioForOpenAI", "getValidNextStates", "incrementMessageCount", "isTerminal", "isValidTransition", "loadRnnoise",
      "noopEventSink", "noopLogger", "parseBrowserVoiceClientMessage", "setInterrupted", "updateActivity", "updateState",
    ],
    types: [
      "A2AAckMailboxTaskInput", "A2AClaimMailboxTasksInput", "A2AGetMailboxTaskInput", "A2AJsonRpcError", "A2AJsonRpcId", "A2AJsonRpcMailboxAdapter",
      "A2AJsonRpcMailboxAdapterOptions", "A2AJsonRpcMailboxContext", "A2AJsonRpcRequest", "A2AJsonRpcResponse", "A2AListMailboxTasksInput", "A2AMailboxMcpToolsOptions",
      "A2AMailboxMessageInput", "A2AMailboxTaskRouter", "A2AMailboxTaskRouterOptions", "A2ASendMailboxMessageInput", "AgentErrorOptions", "AgentEvent",
      "AgentEventType", "AgentMailboxAckInput", "AgentMailboxAddress", "AgentMailboxClaimInput", "AgentMailboxListInput", "AgentMailboxMessage",
      "AgentMailboxMessagePart", "AgentMailboxMessageStatus", "AgentMailboxPort", "AgentMailboxSendInput", "AgentMailboxSubscribeInput", "AgentMailboxWorker",
      "AgentMailboxWorkerHandlerContext", "AgentMailboxWorkerHandlerResult", "AgentMailboxWorkerOptions", "AgentMailboxWorkerRunResult", "ApprovedPendingActionExecutionInput", "AudioChunk",
      "AudioDeltaEvent", "AudioEncoding", "AudioFormatConfig", "AudioInputConfig", "AudioOutputConfig", "AudioPipelineDeps",
      "AudioPlaybackEvent", "AudioReceivedEvent", "AudioSentEvent", "BargeInEvent", "BargeInHandlerCallbacks", "BargeInHandlerConfig",
      "BargeInHandlerEvent", "BargeInState", "BaseEvent", "BaseSessionConfig", "BrowserMediaHandlerCallbacks", "BrowserMediaHandlerConfig",
      "BrowserMediaState", "BrowserVoiceMediaBridge", "BrowserVoiceMediaBridgeFactory", "BrowserVoiceMediaBridgeOptions", "BrowserVoiceServiceConfig", "BrowserVoiceSessionRequest",
      "BrowserVoiceSocket", "BrowserVoiceUserContext", "CascadedMode", "CascadedTransportConfig", "Channel", "ChatCompletionConfig",
      "ChatCompletionResult", "ChatMessage", "ChatMessageRole", "ChatToolCall", "ChatToolDefinition", "ConnectionInfo",
      "ErrorCode", "FunctionCallDoneEvent", "GeminiClientContent", "GeminiClientMessage", "GeminiFunctionDeclaration", "GeminiGenerationConfig",
      "GeminiGoAway", "GeminiPart", "GeminiRealtimeConfig", "GeminiRealtimeInput", "GeminiRealtimeModel", "GeminiServerContent",
      "GeminiServerMessage", "GeminiSetupComplete", "GeminiSetupMessage", "GeminiToolCallCancellation", "GeminiToolCallMessage", "GeminiToolResponse",
      "GeminiVoice", "GrokAudioFormat", "GrokRealtimeConfig", "GrokSessionAudioConfig", "GrokVoice", "IChatTransport",
      "IRealtimeProvider", "ISessionStateMachine", "ISmsTransport", "ITransport", "IVoiceSession", "IVoiceTransport",
      "InMemoryAgentMailboxOptions", "InMemoryMemoryStoreOptions", "InMemoryPendingActionPortOptions", "InterruptControllerDeps", "McpJsonRpcError", "McpJsonRpcId",
      "McpJsonRpcRequest", "McpJsonRpcRequestId", "McpJsonRpcResponse", "McpJsonRpcToolAdapter", "McpJsonRpcToolAdapterOptions", "McpServerInfo",
      "McpStreamableHttpToolHandler", "McpStreamableHttpToolHandlerOptions", "McpToolCallContent", "McpToolCallInput", "McpToolCallResult", "McpToolListResult",
      "McpToolRegistryAdapter", "McpToolRegistryAdapterOptions", "OpenAIApiError", "OpenAIChatConfig", "OpenAIClientEventType", "OpenAIEventHandlers",
      "OpenAIFunctionCall", "OpenAIRealtimeConfig", "OpenAIRealtimeModel", "OpenAIRealtimeReasoningEffort", "OpenAIRealtimeReasoningSetting", "OpenAIServerEvent",
      "OpenAIServerEventType", "OpenAISessionConfig", "OpenAITool", "OpenAIVoice", "PendingToolCall", "ProviderError",
      "ProviderFunctionCall", "RealtimeProviderConfig", "RealtimeProviderType", "RealtimeSessionUpdate", "RealtimeVoiceSessionDeps", "ResponseCreateOptions",
      "ServerVoiceMessage", "SessionContext", "SessionCreatedEvent", "SessionEndReason", "SessionEndedEvent", "SessionErrorEvent",
      "SessionState", "SessionSummary", "SmsCommand", "SmsInboundWebhook", "SmsOutboundMessage", "SmsParsedMessage",
      "SmsResponseFormat", "SmsStatus", "SmsStatusWebhook", "SpeechEvent", "StateMachineConfig", "StateMetadata",
      "StateTransitionResult", "ToolAuthorizationResult", "ToolExecutionPolicyAuditEvent", "ToolExecutionPolicyEngineOptions", "ToolExecutionPolicyInput", "TranscriptEvent",
      "TransportConfig", "TransportConnectedEvent", "TransportDisconnectedEvent", "TransportErrorEvent", "TransportMessage", "TransportState",
      "TransportType", "TurnDetectionConfig", "TwilioCallStatus", "TwilioConnectedMessage", "TwilioDtmfMessage", "TwilioMarkMessage",
      "TwilioMediaMessage", "TwilioOutboundAudio", "TwilioSmsConfig", "TwilioStartMessage", "TwilioStopMessage", "TwilioStreamEvent",
      "TwilioStreamMessage", "TwilioVoiceConfig", "TwilioVoiceEventHandlers", "TwilioVoiceWebhook", "VoiceSessionCallbacks", "VoiceSessionConfig",
      "VoiceSessionTool", "VoiceSessionToolContext", "VoiceSessionToolPolicy",
    ],
    forbiddenValues: [
      "createA2AAgentCard", "mailboxMessageToA2ATask", "toMcpToolDescriptor", "toMcpToolDescriptors",
    ],
  },
  {
    exportPath: "./server/adapters/fastify",
    specifier: "@voiceagentsdk/core/server/adapters/fastify",
    sourceFile: "src/server/adapters/fastify/index.ts",
    packageExport: {
      types: "./dist/server/adapters/fastify/index.d.ts",
      import: "./dist/server/adapters/fastify/index.js",
    },
    runtimeProbe: "createFastifyVoiceAdapter",
    values: [
      "createFastifyVoiceAdapter",
    ],
    types: [
      "FastifyLike", "FastifyRequestLike", "FastifyRouteHandler", "FastifyRouteOptions", "FastifyVoiceAdapterOptions", "FastifyVoiceService",
    ],
  },
  {
    exportPath: "./server/providers",
    specifier: "@voiceagentsdk/core/server/providers",
    sourceFile: "src/server/providers/index.ts",
    packageExport: {
      types: "./dist/server/providers/index.d.ts",
      import: "./dist/server/providers/index.js",
    },
    runtimeProbe: "createOpenAIRealtimeTransport",
    values: [
      "AudioBuffer", "CascadedRealtimeTransport", "GeminiRealtimeTransport", "GrokRealtimeTransport", "OPENAI_BYTES_PER_SAMPLE", "OPENAI_CHANNELS",
      "OPENAI_SAMPLE_RATE", "OpenAIChatTransport", "OpenAIRealtimeTransport", "TwilioSmsTransport", "TwilioVoiceTransport", "buildOpenAIRealtimeSessionConfig",
      "calculateAudioDurationMs", "createAudioChunk", "createCascadedRealtimeTransport", "createGeminiRealtimeTransport", "createGrokRealtimeTransport", "createOpenAIChatTransport",
      "createOpenAIRealtimeTransport", "createTwilioSmsTransport", "createTwilioVoiceTransport", "decodeAudioFromOpenAI", "encodeAudioForOpenAI",
    ],
    types: [
      "CascadedMode", "CascadedTransportConfig", "GeminiRealtimeConfig", "GrokRealtimeConfig", "IRealtimeProvider", "OpenAIChatConfig",
      "OpenAIEventHandlers", "OpenAIRealtimeConfig", "ProviderError", "ProviderFunctionCall", "RealtimeProviderConfig", "RealtimeProviderType",
      "RealtimeSessionUpdate", "TwilioSmsConfig", "TwilioVoiceConfig", "TwilioVoiceEventHandlers",
    ],
  },
  {
    exportPath: "./server/media",
    specifier: "@voiceagentsdk/core/server/media",
    sourceFile: "src/server/media/index.ts",
    packageExport: {
      types: "./dist/server/media/index.d.ts",
      import: "./dist/server/media/index.js",
    },
    runtimeProbe: "createBrowserMediaHandler",
    values: [
      "AcousticEchoCanceller", "AudioBuffer", "AutomaticGainControl", "BargeInHandler", "BrowserMediaHandler", "RnnoiseDenoiser",
      "createAudioChunk", "createBargeInHandler", "createBrowserMediaHandler", "loadRnnoise",
    ],
    types: [
      "AudioChunk", "AudioEncoding", "BargeInHandlerCallbacks", "BargeInHandlerConfig", "BargeInHandlerEvent", "BargeInState",
      "BrowserMediaHandlerCallbacks", "BrowserMediaHandlerConfig", "BrowserMediaState",
    ],
  },
  {
    exportPath: "./server/browser",
    specifier: "@voiceagentsdk/core/server/browser",
    sourceFile: "src/server/browser/index.ts",
    packageExport: {
      types: "./dist/server/browser/index.d.ts",
      import: "./dist/server/browser/index.js",
    },
    runtimeProbe: "createBrowserVoiceService",
    values: [
      "BrowserVoiceService", "createBrowserMediaBridgeDefinition", "createBrowserVoiceService", "createDefaultBrowserMediaBridgeFactory", "parseBrowserVoiceClientMessage",
    ],
    types: [
      "BrowserVoiceMediaBridge", "BrowserVoiceMediaBridgeFactory", "BrowserVoiceMediaBridgeOptions", "BrowserVoiceServiceConfig", "BrowserVoiceSessionRequest", "BrowserVoiceSocket",
      "BrowserVoiceUserContext", "ServerVoiceMessage",
    ],
  },
  {
    exportPath: "./client/browser",
    specifier: "@voiceagentsdk/core/client/browser",
    sourceFile: "src/client/browser/index.ts",
    packageExport: {
      types: "./dist/client/browser/index.d.ts",
      import: "./dist/client/browser/index.js",
    },
    runtimeProbe: "createVoiceWSClient",
    values: [
      "BROWSER_VOICE_AUDIO", "BrowserVoiceSessionClient", "VoiceWebSocketClient", "checkBrowserVoiceSupport", "createBrowserVoiceSessionClient", "createVoiceWSClient",
      "getCaptureWorkletURL", "getPlaybackWorkletURL", "revokeWorkletURLs",
    ],
    types: [
      "BrowserVoiceAudioMode", "BrowserVoiceSessionCallbacks", "BrowserVoiceSessionClientOptions", "BrowserVoiceSessionSnapshot", "BrowserVoiceState", "BrowserVoiceSupport",
      "ClientVoiceMessage", "ServerVoiceMessage", "ToolCallEntry", "TranscriptEntry", "VoiceLearningStatus", "VoiceLearningSummary",
      "VoiceProvider", "VoiceSessionStartOptions", "VoiceSessionSummary", "VoiceWSCallbacks", "VoiceWSClient",
    ],
  },
] as const satisfies readonly PublicApiEntry[];

export const publicApiExportPaths = publicApiEntries.map((entry) => entry.exportPath);
