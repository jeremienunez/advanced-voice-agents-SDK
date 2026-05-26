export interface OpenAIChatConfig {
  apiKey: string;
  /** Default model (e.g., "gpt-4o-mini", "gpt-5-mini") */
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

export interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: "stop" | "tool_calls" | "length";
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  system_fingerprint?: string;
}

export interface OpenAIErrorResponse {
  error: { message: string; type: string; code: string | null };
}

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
