import type { CompiledAgentArtifact } from "@voiceagentsdk/core/sdk";

export function withRuntimeKnowledgePolicy(
  prompt: string,
  artifact: CompiledAgentArtifact | undefined,
): string {
  if (!artifact?.knowledge || artifact.knowledge.status !== "compiled") {
    return prompt;
  }
  if (!hasKnowledgeTool(artifact.selectedTools)) return prompt;
  if (prompt.includes("search_knowledge")) return prompt;

  return [
    prompt,
    "",
    "Runtime knowledge tool:",
    "- Use search_knowledge before factual answers that depend on uploaded or researched knowledge.",
    "- Prefer mode=hybrid, limit=4 for broad questions; use mode=lexical for exact names, identifiers, routes, regions, or appellations.",
    "- Use retrieved context as evidence, not as a script. Answer in short spoken language.",
    "- Preserve the agent's atmosphere while grounding the answer: do not become a dry search summary.",
    "- Cite document names naturally only when they materially support the answer.",
    "- If retrieval is empty, weak, stale, or contradictory, say the knowledge base does not confirm the answer and ask one targeted follow-up.",
    "- Do not invent citations, source names, scores, URLs, policies, prices, or tool results.",
  ].join("\n");
}

export function hasKnowledgeTool(selectedTools: string[]): boolean {
  return (
    selectedTools.includes("search_knowledge") ||
    selectedTools.includes("answer_from_knowledge")
  );
}
