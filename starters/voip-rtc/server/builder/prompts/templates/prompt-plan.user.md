<task>
Create prompt planning JSON for this voice-agent draft.
</task>

<success_criteria>
- The plan is specific enough for a final prompt to be compiled without guessing.
- The plan is optimized for realtime speech: short turns, one question at a time, explicit tool boundaries.
- The plan surfaces missing user decisions only when they are blocking or high-risk.
- The plan keeps factual claims grounded in the draft only; unsupported domain claims go into warnings or assumptions.
- The plan defines a memorable but controlled voice atmosphere: how the agent sounds, how it opens, how it handles silence, uncertainty, and recovery.
</success_criteria>

<output_contract>
Return this exact shape:
{
  "questions": [{"id": "autonomy_level", "label": "string", "reason": "string", "required": true}],
  "assumptions": ["string"],
  "recommendedVoice": {"provider": "gemini", "voice": "string", "tone": "string", "rationale": "string"},
  "promptPart1": "string",
  "doRules": ["string"],
  "dontRules": ["string"],
  "confidence": 0.85,
  "warnings": ["string"]
}
</output_contract>

<planning_rules>
- Return at most 5 questions.
- Mark `required: true` only when the answer changes safety, legality, data access, user permissions, or core outcome.
- `assumptions` must be explicit and safe to proceed with if the builder accepts unanswered questions.
- `recommendedVoice.provider` should be `"gemini"` unless the draft clearly requires another available provider.
- `recommendedVoice.tone` must describe speech behavior: pace, warmth, confidence, restraint, and recovery style.
- `promptPart1` must be a compact system-prompt foundation with sections for role, goal, presence/atmosphere, voice style, operating rules, boundaries, and clarification behavior.
- The atmosphere must be domain-specific. A travel concierge, support agent, teacher, sales qualifier, and technical assistant should not sound identical.
- Include micro-behaviors that improve voice UX: brief opening, smooth turn transitions, one-sentence acknowledgements, and graceful repair when audio or context is unclear.
- `doRules` must be positive behaviors the final prompt should preserve.
- `dontRules` must be hard prohibitions the final prompt should preserve.
- `confidence` must be between 0 and 1 and reflect draft completeness.
- `warnings` must include missing operational data, risky ambiguity, unsupported document assumptions, or weak scope.
</planning_rules>

<draft_json>
{{draftJson}}
</draft_json>
