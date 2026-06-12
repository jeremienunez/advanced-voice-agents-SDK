import type { IRealtimeProvider } from "../types/transport.types.js";
import type {
  IVoiceSession,
  PendingToolCall,
  SessionContext,
  SessionEndReason,
  SessionState,
  VoiceSessionTool,
  VoiceSessionCallbacks,
  VoiceSessionConfig,
} from "../types/session.types.js";
import type { ProviderFunctionCall } from "../types/transport.types.js";
import { AgentError, ERROR_CODES } from "../types/error.types.js";
import { toAffect } from "./affect-side-channel.js";
import { createAgentLogger } from "../utils/logger.js";
import { ToolExecutionPolicyEngine } from "./tool-execution-policy-engine.js";
import { createStateMachine, type SessionStateMachine } from "./state-machine.js";
import {
  addPendingToolCall,
  createSessionContext,
  createSessionSummary,
  finishPendingToolCall,
  incrementMessageCount,
  updateState,
  updatePendingToolCall,
} from "./context.js";

export interface RealtimeVoiceSessionDeps {
  provider: IRealtimeProvider;
  tools?: VoiceSessionTool[];
  toolPolicyEngine?: ToolExecutionPolicyEngine;
}

export class RealtimeVoiceSession implements IVoiceSession {
  readonly sessionId: string;
  readonly config: VoiceSessionConfig;

  private readonly provider: IRealtimeProvider;
  private readonly callbacks: VoiceSessionCallbacks;
  private readonly stateMachine: SessionStateMachine;
  private readonly toolPolicyEngine: ToolExecutionPolicyEngine;
  private readonly tools: Map<string, VoiceSessionTool>;
  private context: SessionContext;
  private readonly logger = createAgentLogger("RealtimeVoiceSession");

  constructor(
    config: VoiceSessionConfig,
    deps: RealtimeVoiceSessionDeps,
    callbacks: VoiceSessionCallbacks = {},
  ) {
    this.sessionId = config.sessionId;
    this.config = config;
    this.provider = deps.provider;
    this.callbacks = callbacks;
    this.toolPolicyEngine = deps.toolPolicyEngine ?? new ToolExecutionPolicyEngine();
    this.tools = new Map((deps.tools ?? []).map((tool) => [tool.name, tool]));
    this.context = createSessionContext(config);
    this.stateMachine = createStateMachine({
      sessionId: config.sessionId,
      channel: "voice",
      initialState: "initializing",
    });
    this.registerProviderCallbacks();
  }

  get state(): SessionState {
    return this.stateMachine.state;
  }

  async start(): Promise<void> {
    this.transitionTo("connecting");
    await this.provider.connect();
    this.transitionTo("active");
    this.transitionTo("listening");
  }

  async end(reason: SessionEndReason = "completed"): Promise<void> {
    if (this.stateMachine.isTerminated) return;
    this.transitionTo("ending");
    await this.provider.disconnect();
    this.transitionTo("ended");
    this.callbacks.onEnded?.(createSessionSummary(this.context, reason));
  }

  handleAudio(chunk: Buffer): void {
    void this.provider
      .sendAudio({
        payload: chunk,
        encoding: this.config.inputFormat ?? "pcm16",
        sampleRate: this.config.sampleRate ?? 24000,
        channels: 1,
        timestamp: Date.now(),
      })
      .catch((error: unknown) => {
        this.handleError(
          AgentError.from(error, ERROR_CODES.TRANSPORT_SEND_FAILED, {
            sessionId: this.sessionId,
          }),
        );
      });
  }

  interrupt(): void {
    this.transitionTo("interrupted");
    void this.provider.cancelResponse().catch((error: unknown) => {
      this.handleError(
        AgentError.from(error, ERROR_CODES.INTERNAL_ERROR, {
          sessionId: this.sessionId,
          action: "interrupt",
        }),
      );
    });
    this.callbacks.onInterrupted?.();
  }

  private registerProviderCallbacks(): void {
    this.provider.onAudio((chunk) => {
      this.callbacks.onAudioOutput?.(chunk);
    });
    this.provider.onTranscript((text, isFinal, role) => {
      if (isFinal) {
        this.context = incrementMessageCount(this.context);
      }
      this.callbacks.onTranscript?.(text, isFinal, role);
    });
    this.provider.onSpeechStarted(() => {
      this.transitionTo("listening");
    });
    this.provider.onResponseStarted(() => {
      this.transitionTo("speaking");
    });
    this.provider.onResponseCompleted(() => {
      this.transitionTo("listening");
    });
    this.provider.onError((error) => {
      this.handleError(
        new AgentError({
          code: ERROR_CODES.TRANSPORT_WEBSOCKET_ERROR,
          message: error.message,
          context: { sessionId: this.sessionId, providerCode: error.code },
          recoverable: true,
        }),
      );
    });
    this.provider.onFunctionCall((call) => {
      void this.handleFunctionCall(call);
    });
  }

  private async handleFunctionCall(call: ProviderFunctionCall): Promise<void> {
    const args = parseToolArguments(call.arguments);
    /* server-DEFINED side-channel tools are render hints, not actions:
       route to the callback and answer the model without a pending call */
    if (this.tools.get(call.name)?.sideChannel === "affect") {
      this.callbacks.onAffect?.(toAffect(args));
      await this.provider.submitFunctionResult(call.callId, { ok: true }, true);
      return;
    }
    const pending = createPendingToolCall(call, args);
    this.context = addPendingToolCall(this.context, pending);
    this.callbacks.onToolCall?.(pending);

    const tool = this.tools.get(call.name);
    if (!tool) {
      await this.failToolCall(pending, `Unknown tool "${call.name}"`);
      return;
    }

    const executing: PendingToolCall = { ...pending, status: "executing" };
    this.context = updatePendingToolCall(this.context, executing);
    this.callbacks.onToolCall?.(executing);
    this.transitionTo("processing");
    this.transitionTo("processing_tool");

    try {
      const context = {
        sessionId: this.sessionId,
        tenantId: this.config.tenantId,
        userId: this.config.userId,
        agentId: this.config.agentId,
        providerId: this.config.providerId,
      };
      const result = await this.toolPolicyEngine.execute({ tool, args, context });
      if (isConfirmationRequiredResult(result)) {
        const awaitingConfirmation: PendingToolCall = {
          ...executing,
          status: "awaiting_confirmation",
          result,
        };
        this.context = updatePendingToolCall(this.context, awaitingConfirmation);
        this.callbacks.onToolCall?.(awaitingConfirmation);
        this.transitionTo("active");
        return;
      }
      await this.provider.submitFunctionResult(call.callId, result, true);
      const completed: PendingToolCall = {
        ...executing,
        status: "completed",
        result,
      };
      this.context = finishPendingToolCall(this.context, completed);
      this.callbacks.onToolCall?.(completed);
      this.transitionTo("active");
    } catch (error) {
      await this.failToolCall(executing, errorMessage(error));
    }
  }

  private async failToolCall(
    call: PendingToolCall,
    message: string,
  ): Promise<void> {
    const failed: PendingToolCall = { ...call, status: "failed", error: message };
    this.context = finishPendingToolCall(this.context, failed);
    this.callbacks.onToolCall?.(failed);
    await this.provider.submitFunctionResult(
      call.callId,
      { error: message },
      true,
    );
    this.transitionTo("active");
  }

  private transitionTo(state: SessionState): void {
    const result = this.stateMachine.transition(state);
    if (!result.success) {
      this.logger.warn("Ignored invalid state transition", {
        sessionId: this.sessionId,
        from: result.previousState,
        to: state,
      });
      return;
    }
    this.context = updateState(this.context, state);
    this.callbacks.onStateChange?.(state);
  }

  private handleError(error: AgentError): void {
    this.transitionTo("error");
    this.callbacks.onError?.(error);
  }
}

function createPendingToolCall(
  call: ProviderFunctionCall,
  args: Record<string, unknown>,
): PendingToolCall {
  return {
    callId: call.callId,
    toolName: call.name,
    arguments: args,
    startedAt: Date.now(),
    status: "pending",
  };
}

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep malformed provider arguments visible to the tool callback.
  }
  return { raw: value };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isConfirmationRequiredResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const envelope = result as {
    pendingActionId?: unknown;
    status?: unknown;
    toolName?: unknown;
  };
  return envelope.status === "confirmation_required" &&
    typeof envelope.pendingActionId === "string" &&
    typeof envelope.toolName === "string";
}

export function createRealtimeVoiceSession(
  config: VoiceSessionConfig,
  deps: RealtimeVoiceSessionDeps,
  callbacks?: VoiceSessionCallbacks,
): RealtimeVoiceSession {
  return new RealtimeVoiceSession(config, deps, callbacks);
}
