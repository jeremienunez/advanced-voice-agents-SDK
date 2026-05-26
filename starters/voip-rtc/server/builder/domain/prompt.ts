import type {
  AgentBuildDraft,
  CompiledAgentArtifact,
  PromptBuildPlan,
  ToolName,
  VoiceAgentSdkDefinition,
} from "@voiceagentsdk/core/sdk";
import { readChunkCount, readKnowledgeStoreId } from "../utils.js";

export function fallbackPromptPlan(draft: AgentBuildDraft): PromptBuildPlan {
  const identity = draft.identity;
  const doRules = [
    ...identity.mustDo,
    "Maintain a deliberate spoken presence that matches the domain and user situation.",
    "Keep spoken answers short and action-oriented.",
    "Use brief acknowledgements and smooth transitions so the conversation feels human and controlled.",
    "Ask one clarification question at a time when the user's request is ambiguous.",
    "State uncertainty clearly when context is missing or weak.",
  ];
  const dontRules = [
    ...identity.mustNotDo,
    "Do not invent facts, citations, prices, schedules, policies, or tool results.",
    "Do not perform external actions without explicit user confirmation.",
  ];
  return {
    questions: [
      {
        id: "autonomy_level",
        label: "What can the agent do autonomously before escalation?",
        reason: "Tool use and escalation limits must be explicit before runtime.",
        required: true,
      },
      {
        id: "success_metric",
        label: "What observable outcome defines a successful conversation?",
        reason: "The final prompt needs a measurable success target.",
      },
      {
        id: "handoff_rule",
        label: "When should the agent hand off to a human?",
        reason: "Low-confidence and permission-sensitive cases need a safe fallback.",
      },
    ],
    assumptions: [
      "The primary channel is realtime spoken conversation.",
      "The agent should answer briefly, verify intent, and ask one question at a time.",
      "External actions require explicit user confirmation.",
    ],
    recommendedVoice: {
      provider: "gemini",
      voice: "Puck",
      tone: "calm, clear, warm, concise, operational, graceful under uncertainty",
      rationale:
        "Puck provides a neutral voice baseline that can carry a polished but restrained RTC atmosphere.",
    },
    promptPart1: [
      `Identity: You are ${identity.publicAgentName}, a realtime conversational voice agent.`,
      `Primary goal: ${identity.intent}`,
      "",
      "Presence and atmosphere:",
      "- Sound calm, focused, and intentional.",
      "- Match the domain: practical for support, refined for concierge, precise for technical guidance, encouraging for teaching.",
      "- Use small acknowledgements before solving: short phrases like understood, I can help with that, or let me check the right context.",
      "- Recover gracefully when audio or context is unclear.",
      "",
      "Voice style:",
      "- Use short spoken sentences.",
      "- Ask one question at a time.",
      "- Avoid long lists unless the user asks for detail.",
      "",
      "Operating rules:",
      ...doRules.map((rule) => `- ${rule}`),
      "",
      "Boundaries:",
      ...dontRules.map((rule) => `- ${rule}`),
      "",
      "Clarification behavior:",
      "- If the user request is underspecified, ask the smallest useful follow-up question.",
      "- If a request is outside scope, say so briefly and offer a safe next step.",
    ].join("\n"),
    doRules,
    dontRules,
    confidence: 0.68,
    warnings: [
      "Local fallback used: builder model unavailable or request failed.",
      "Autonomy, handoff, and success metric should be confirmed by the builder.",
    ],
  };
}

export function fallbackFinalPrompt(
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
): string {
  return [
    draft.promptPlan?.promptPart1 ?? fallbackPromptPlan(draft).promptPart1,
    "",
    "Conversation policy:",
    "- Keep the atmosphere intentional: present, warm, controlled, and domain-appropriate.",
    "- Use brief acknowledgements and clean transitions before asking or answering.",
    "- Keep each spoken turn concise and natural.",
    "- Ask one clarification question at a time.",
    "- Confirm before any external action, write operation, handoff, booking, or follow-up.",
    "- Do not expose hidden reasoning, internal scores, or implementation details.",
    "",
    "Knowledge policy:",
    `- Retrieval strategy: ${draft.knowledgePlan?.strategy ?? "none"}.`,
    "- Use retrieved context before factual domain answers when a knowledge tool is available.",
    "- Cite document names naturally in speech when retrieved context materially supports the answer.",
    "- If context is missing, stale, contradictory, or weak, say it clearly and ask one targeted question.",
    "- Do not invent citations or sources.",
    "",
    "Tool policy:",
    toolInstructions(draft, selectedTools),
    "",
    "Escalation policy:",
    "- Escalate or offer human handoff when confidence is low, permission is missing, context conflicts, or the user asks for sensitive advice outside scope.",
    "",
    "Success criteria:",
    "- The user understands the next step.",
    "- The answer is grounded in available context or clearly marked as uncertain.",
    "- The agent completes only actions that are permitted and confirmed.",
  ].join("\n");
}

export function promptPlanWithClarifications(
  plan: PromptBuildPlan,
  answers: Record<string, string>,
  acceptUnanswered: boolean,
): PromptBuildPlan {
  const answered = plan.questions
    .map((question) => ({
      question,
      answer: answers[question.id]?.trim() ?? "",
    }))
    .filter((item) => item.answer.length > 0);

  const clarificationBlock =
    answered.length > 0
      ? [
          "",
          "Clarifications utilisateur validees:",
          ...answered.map((item) => `- ${item.question.label}: ${item.answer}`),
        ].join("\n")
      : "";

  return {
    ...plan,
    questions: acceptUnanswered
      ? []
      : plan.questions.filter((question) => !answers[question.id]?.trim()),
    assumptions: [
      ...plan.assumptions,
      ...(acceptUnanswered && plan.questions.length > answered.length
        ? ["Les questions sans reponse explicite utilisent les hypotheses du builder."]
        : []),
    ],
    promptPart1: `${plan.promptPart1}${clarificationBlock}`,
  };
}

export function toolInstructions(
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
): string {
  const selected = draft.toolRegistry.filter((item) =>
    selectedTools.includes(item.name),
  );
  if (selected.length === 0) return "- No tools are enabled.";
  return selected
    .map((tool, index) => {
      return `${index + 1}. ${tool.name}: ${tool.description} Permissions: ${tool.permissions.join(", ")}.`;
    })
    .join("\n");
}

export function compileArtifact(
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
  prompt: string,
): CompiledAgentArtifact {
  const sdkDefinition: VoiceAgentSdkDefinition = {
    tenants: [
      {
        id: "builder-preview",
        displayName: draft.identity.publicAgentName,
        defaultProviderId: "gemini",
        defaultMediaBridgeId: "browser",
      },
    ],
    providers: [
      {
        id: "gemini",
        kind: "gemini-live",
        displayName: "Gemini Live",
        apiKey: { name: "GEMINI_API_KEY" },
        model: "gemini-3.1-flash-live-preview",
        voice: draft.promptPlan?.recommendedVoice.voice ?? "Puck",
        inputSampleRate: 16000,
        outputSampleRate: 24000,
      },
    ],
    mediaBridges: [
      {
        id: "browser",
        kind: "browser-websocket",
        providerId: "gemini",
        inputEncoding: "pcm16",
        outputEncoding: "pcm16",
        sampleRate: 24000,
      },
    ],
    plans: [],
    prompts: [
      {
        id: "builder-final-prompt",
        title: "Compiled builder prompt",
        channels: ["voice"],
        priority: 1,
        body: prompt,
      },
    ],
    tools: [],
    databases: draft.databasePlan
      ? [
          {
            id: draft.databasePlan.schemaName,
            displayName: `${draft.identity.publicAgentName} knowledge DB`,
            tables: draft.databasePlan.tables,
            collections: [],
            vectorIndexes: [
              {
                id: `${draft.databasePlan.schemaName}.knowledge_chunks.embedding`,
                dimensions: draft.databasePlan.vectorization.dimensions,
                metric: draft.databasePlan.vectorization.index.metric,
              },
            ],
            kvNamespaces: [],
          },
        ]
      : [],
    stores: [],
    onboarding: [],
    packs: [],
  };

  return {
    draftId: draft.id,
    sdkDefinition,
    prompt,
    toolRegistry: draft.toolRegistry,
    selectedTools,
    knowledge: {
      strategy: draft.knowledgePlan?.strategy ?? "hybrid",
      storeId: readKnowledgeStoreId(draft.metadata?.knowledgeStore),
      documentCount: draft.knowledgePlan?.documents.length ?? 0,
      chunkCount: readChunkCount(draft.metadata?.knowledgeStore),
      status: draft.metadata?.knowledgeStore ? "compiled" : "planned",
    },
    createdAt: new Date().toISOString(),
  };
}
