/**
 * Chat Completions Types - OpenAI Chat Completions API types for SMS agent
 * Used by OpenAIChatTransport for request/response structured communication
 */

// ============================================================================
// Message Types
// ============================================================================

/** Chat message roles matching OpenAI API */
export type ChatMessageRole = "system" | "user" | "assistant" | "tool";

/** A single message in the Chat Completions conversation */
export interface ChatMessage {
  role: ChatMessageRole;
  content: string | null;
  /** Present when role is "assistant" and the model wants to call tools */
  tool_calls?: ChatToolCall[];
  /** Present when role is "tool" — echoes the tool_call id */
  tool_call_id?: string;
}

// ============================================================================
// Tool Call Types
// ============================================================================

/** A tool call returned by the model */
export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON-encoded arguments string */
    arguments: string;
  };
}

/** Tool definition sent to the API */
export interface ChatToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ============================================================================
// Configuration
// ============================================================================

/** Configuration for a Chat Completions request */
export interface ChatCompletionConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Tool choice strategy: "auto" | "none" | "required" */
  toolChoice?: "auto" | "none" | "required";
  /** Allow multiple tool calls in one response (default: true) */
  parallelToolCalls?: boolean;
  /** Reasoning effort for GPT-5 models (default: "low" for SMS) */
  reasoningEffort?: "low" | "medium" | "high";
  /** Stable user identifier for abuse monitoring */
  user?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/** Parsed response from a Chat Completions call */
export interface ChatCompletionResult {
  /** The assistant message (content may be null if tool_calls present) */
  message: ChatMessage;
  /** Why the model stopped: "stop" | "tool_calls" | "length" */
  finishReason: "stop" | "tool_calls" | "length";
  /** Token usage from the API */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Transport Interface
// ============================================================================

/** Interface for Chat Completions transport implementations */
export interface IChatTransport {
  /**
   * Send a chat completion request
   * @param messages - Conversation history
   * @param tools - Available tool definitions (optional)
   * @param config - Per-request config overrides (optional)
   * @returns The assistant response + finish reason
   */
  chat(
    messages: ChatMessage[],
    tools?: ChatToolDefinition[],
    config?: Partial<ChatCompletionConfig>,
  ): Promise<ChatCompletionResult>;
}
