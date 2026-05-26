import { createAgentLogger } from "../../utils/logger.js";
import {
  CORRECTION_PATTERNS,
  DEFAULT_CONFIG,
  POLITE_PATTERNS,
  SENSITIVITY_THRESHOLDS,
  URGENCY_PATTERNS,
} from "./patterns.js";
import type {
  BargeInEvent,
  BargeInHandlerCallbacks,
  BargeInHandlerConfig,
  BargeInState,
} from "./types.js";

export class BargeInHandler {
  private config: Required<BargeInHandlerConfig>;
  private callbacks: BargeInHandlerCallbacks;
  private logger = createAgentLogger("BargeInHandler");

  private _state: BargeInState = "idle";
  private speechStartTime: number | null = null;
  private cooldownEndTime: number | null = null;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private isAISpeaking = false;

  constructor(
    config: BargeInHandlerConfig = {},
    callbacks: BargeInHandlerCallbacks = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;

    if (this.config.debug) {
      this.logger.debug("BargeInHandler initialized", { config: this.config });
    }
  }

  get state(): BargeInState {
    return this._state;
  }

  get isInCooldown(): boolean {
    return (
      this._state === "cooldown" &&
      this.cooldownEndTime !== null &&
      Date.now() < this.cooldownEndTime
    );
  }

  startMonitoring(): void {
    if (this._state === "cooldown" && this.isInCooldown) {
      return;
    }

    this.isAISpeaking = true;
    this.setState("monitoring");

    if (this.config.debug) {
      this.logger.debug("Started monitoring for barge-ins");
    }
  }

  stopMonitoring(): void {
    this.isAISpeaking = false;
    this.speechStartTime = null;

    if (this._state !== "cooldown") {
      this.setState("idle");
    }

    if (this.config.debug) {
      this.logger.debug("Stopped monitoring");
    }
  }

  handleSpeechStart(): void {
    if (!this.isAISpeaking || this._state === "cooldown") return;

    this.speechStartTime = Date.now();
    this.setState("detecting");

    if (this.config.debug) {
      this.logger.debug("User speech detected while AI speaking");
    }
  }

  handleSpeechEnd(): void {
    if (this._state === "detecting") {
      this.speechStartTime = null;
      this.setState(this.isAISpeaking ? "monitoring" : "idle");
    }
  }

  handleTranscript(text: string): void {
    if (!this.config.enableFrenchPatterns) return;
    if (this._state !== "detecting" && this._state !== "monitoring") return;
    if (!this.isAISpeaking) return;

    const pattern = this.detectLinguisticTrigger(text);
    if (pattern) {
      this.triggerBargeIn("linguistic", pattern);
    }
  }

  forceTrigger(trigger: BargeInEvent["trigger"] = "speech_detected"): void {
    if (this._state === "cooldown" && this.isInCooldown) return;
    this.triggerBargeIn(trigger);
  }

  checkSpeechDuration(): boolean {
    if (this._state !== "detecting" || this.speechStartTime === null) {
      return false;
    }

    const duration = Date.now() - this.speechStartTime;
    const threshold = SENSITIVITY_THRESHOLDS[this.config.sensitivity];

    if (duration >= threshold.minDuration) {
      this.triggerBargeIn("speech_detected");
      return true;
    }

    return false;
  }

  reset(): void {
    this.isAISpeaking = false;
    this.speechStartTime = null;
    this.cooldownEndTime = null;
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.setState("idle");
  }

  private setState(state: BargeInState): void {
    if (this._state === state) return;

    this._state = state;
    this.callbacks.onStateChange?.(state);

    if (this.config.debug) {
      this.logger.debug("State changed", { state });
    }
  }

  private triggerBargeIn(
    trigger: BargeInEvent["trigger"],
    pattern?: string,
  ): void {
    const speechDurationMs = this.speechStartTime
      ? Date.now() - this.speechStartTime
      : 0;

    const threshold = SENSITIVITY_THRESHOLDS[this.config.sensitivity];
    const confidence = Math.min(
      1,
      speechDurationMs / (threshold.minDuration * 2),
    );

    const event: BargeInEvent = {
      timestamp: Date.now(),
      speechDurationMs,
      confidence: trigger === "linguistic" ? 0.9 : confidence,
      trigger,
      pattern,
    };

    this.setState("triggered");
    this.callbacks.onBargeIn?.(event);

    if (this.config.debug) {
      this.logger.info("Barge-in triggered", { ...event });
    }

    this.cooldownEndTime = Date.now() + this.config.cooldownMs;
    this.setState("cooldown");

    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null;
      if (this._state === "cooldown") {
        this.setState(this.isAISpeaking ? "monitoring" : "idle");
        this.cooldownEndTime = null;
      }
    }, this.config.cooldownMs);
  }

  private detectLinguisticTrigger(text: string): string | null {
    const normalized = text.trim().toLowerCase();

    for (const pattern of URGENCY_PATTERNS) {
      if (pattern.test(normalized)) {
        return pattern.source;
      }
    }

    for (const pattern of POLITE_PATTERNS) {
      if (pattern.test(normalized)) {
        return pattern.source;
      }
    }

    for (const pattern of CORRECTION_PATTERNS) {
      if (pattern.test(normalized)) {
        return pattern.source;
      }
    }

    return null;
  }
}

export function createBargeInHandler(
  config?: BargeInHandlerConfig,
  callbacks?: BargeInHandlerCallbacks,
): BargeInHandler {
  return new BargeInHandler(config, callbacks);
}
