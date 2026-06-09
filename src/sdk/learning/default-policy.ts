import type {
  AgentLearningPolicyPort,
  LearningRunDecision,
} from "../types/learning-loop/index.js";

export function createDefaultLearningPolicy(): AgentLearningPolicyPort {
  return {
    decide({ profile, signals }): LearningRunDecision {
      if (profile === "observe") {
        return {
          action: "none",
          reason: "Learning profile is observe; no writes or mutations were performed.",
          confidence: signals.confidence,
        };
      }
      if (profile === "memory_only") {
        return {
          action: "write_memory",
          reason: "Learning profile allows scoped memory writes only.",
          confidence: signals.confidence,
        };
      }
      if (profile === "memory_and_candidates") {
        return {
          action: "candidate",
          reason: "Learning profile writes memory and creates inactive candidate deltas.",
          confidence: signals.confidence,
        };
      }
      if (profile === "approval_required") {
        return {
          action: "pending_approval",
          reason: "Learning profile requires approval before agent mutation.",
          requiresApproval: true,
          confidence: signals.confidence,
        };
      }
      if (signals.confidence < 0.5) {
        return {
          action: "reject",
          reason: "Learning signal confidence is too low for automatic evolution.",
          confidence: signals.confidence,
        };
      }
      return {
        action: "apply",
        reason: "Prompt-safe learning is eligible for automatic application.",
        confidence: signals.confidence,
      };
    },
  };
}
