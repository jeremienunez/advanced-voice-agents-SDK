export interface BargeInHandlerConfig {
  /** Minimum speech duration in ms before triggering (default: 150ms) */
  minSpeechDurationMs?: number;
  /** Cooldown period after a barge-in before allowing another (default: 500ms) */
  cooldownMs?: number;
  /** Sensitivity level affects detection thresholds */
  sensitivity?: "low" | "medium" | "high";
  /** Enable French linguistic patterns for detection */
  enableFrenchPatterns?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

export interface BargeInHandlerCallbacks {
  /** Called when a barge-in is detected */
  onBargeIn?: (event: BargeInEvent) => void;
  /** Called when state changes */
  onStateChange?: (state: BargeInState) => void;
}

export interface BargeInEvent {
  /** When the barge-in was detected */
  timestamp: number;
  /** How long the user had been speaking before detection (ms) */
  speechDurationMs: number;
  /** Confidence level 0-1 */
  confidence: number;
  /** What triggered the barge-in */
  trigger: "speech_detected" | "linguistic" | "urgency";
  /** If linguistic trigger, the matched pattern */
  pattern?: string;
}

export type BargeInState =
  | "idle"
  | "monitoring"
  | "detecting"
  | "triggered"
  | "cooldown";
