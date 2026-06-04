<task>
Compose the final realtime voice-agent prompt from prompt part 1, knowledge strategy, selected tools, limits, tool order, and RAG citation rules.
</task>

<output_contract>
Return this exact shape:
{"finalPrompt": "string"}
</output_contract>

<hard_requirements>
- The prompt must be directly usable by Gemini Realtime, OpenAI Realtime, or another voice runtime.
- The prompt must be concise enough for low-latency speech while still complete.
- Preserve the user's must-do and must-never-do constraints.
- Include a presence and atmosphere policy: what the agent should feel like in speech, how it opens, how it transitions, and how it recovers from unclear audio or missing context.
- Include a clear voice interaction policy: short spoken turns, one question at a time, confirm before external actions.
- Include an uncertainty policy: say when knowledge is missing, weak, or outside scope.
- Include tool policy for each selected tool: when to use it, when not to use it, and what permission or confirmation is needed.
- Include RAG policy when a knowledge tool is selected: search before factual domain answers, cite document names naturally, do not invent citations.
- Include safety/escalation policy for low confidence, missing permission, sensitive requests, or conflicting context.
- Do not include hidden reasoning, internal scoring, JSON schemas, or implementation notes in the final prompt.
</hard_requirements>

<final_prompt_structure>
The `finalPrompt` string should use these compact sections:
1. Identity and goal
2. Presence and atmosphere
3. Voice style
4. Conversation policy
5. Knowledge policy
6. Tool policy
7. Boundaries and escalation
8. Success criteria
</final_prompt_structure>

<composition_attempt>
{{compositionAttempt}}
</composition_attempt>

<quality_feedback>
If `promptQualityFeedbackJson` is not empty, rewrite the final prompt until every listed invariant is satisfied. Do not explain the repair. Return only the corrected JSON object.
{{promptQualityFeedbackJson}}
</quality_feedback>

<previous_prompt>
If present, this previous attempt failed validation and must be corrected rather than copied.
{{previousPrompt}}
</previous_prompt>

<draft_json>
{{draftJson}}
</draft_json>

<selected_tools_json>
{{selectedToolsJson}}
</selected_tools_json>
