import type {
  EvaluationResult,
  LearningReceipt,
  LearningRunDecision,
  LearningSessionInput,
  SessionLearningSignals,
} from "../types.js";

export function createLearningReceipt(input: {
  runId: string;
  session: LearningSessionInput;
  signals: SessionLearningSignals;
  decision: LearningRunDecision;
  evaluation?: EvaluationResult;
  previousArtifactId?: string;
  nextArtifactId?: string;
}): LearningReceipt {
  return {
    id: `receipt_${crypto.randomUUID()}`,
    runId: input.runId,
    sourceSessionId: input.session.summary.sessionId,
    inputHash: stableHash(JSON.stringify({
      sessionId: input.session.summary.sessionId,
      agentId: input.session.agentId,
      draftId: input.session.draftId,
      tenantId: input.session.tenantId,
      userId: input.session.userId,
    })),
    redactions: input.signals.redactions,
    deltas: input.signals.deltas,
    decision: input.decision,
    evaluation: input.evaluation,
    previousArtifactId: input.previousArtifactId,
    nextArtifactId: input.nextArtifactId,
    createdAt: new Date().toISOString(),
  };
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return `sha-lite:${Math.abs(hash).toString(16)}`;
}
