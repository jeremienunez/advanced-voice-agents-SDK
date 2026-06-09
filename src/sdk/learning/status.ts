import type {
  LearningRunStatus,
} from "../types/learning/index.js";
import type {
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningRunStatusUpdate,
} from "../types/learning-loop/index.js";

export async function publishLearningRunStatus(
  repository: LearningRunRepositoryPort,
  update: LearningRunStatusUpdate,
): Promise<LearningRunRecord> {
  const current = await repository.get(update.runId);
  if (!current) throw new Error(`Learning run not found: ${update.runId}`);
  const now = new Date().toISOString();
  return repository.save({
    ...current,
    status: update.status,
    message: update.message ?? current.message,
    error: update.error,
    decision: update.decision ?? current.decision,
    metadata: update.metadata ?? current.metadata,
    evaluatedAt: update.status === "evaluated" ? now : current.evaluatedAt,
    finishedAt: isTerminal(update.status) ? now : current.finishedAt,
  });
}

function isTerminal(status: LearningRunStatus): boolean {
  return ["applied", "pending_approval", "rejected", "failed", "skipped"].includes(status);
}
