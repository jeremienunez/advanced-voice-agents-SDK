<task>
Grow the voice-agent knowledge base for this objective.
</task>

<important_rules>
- Work inside the explicit budget and search intents.
- Start by defining a formal implementation plan for the knowledge base.
- State the checkpoints you will use to stay aligned with that plan.
- Prefer official tourism, wine-route, appellation, regional, and public institutional sources.
- Do not invent facts.
- If you do not have native web browsing/search in this provider, clearly mark source candidates as "to verify" instead of presenting them as verified.
- Include source URLs beside claims only when the URL is known from provided context or model/tool output.
- If no uploaded document metadata is present, create the first knowledge corpus from research distillation and source candidates.
- Keep voice-agent usage in mind: prioritize facts that help answer short spoken user questions.
- Extract entities, relationships, user intents, routing/escalation gaps, and RAG additions that the builder can use later.
- Capture "conversation atmosphere": user mood, trust cues, domain vocabulary, moments of hesitation, and what a strong spoken answer should feel like.
- Include voice-ready teaching material: scenario drills, correction notes, short answer patterns, and handoff moments.
- Do not include filler explanations about your process.
</important_rules>

<objective>
{{objective}}
</objective>

<search_intents_json>
{{queriesJson}}
</search_intents_json>

<source_budget_remaining>
{{remainingSources}}
</source_budget_remaining>

<agent_intent>
{{agentIntent}}
</agent_intent>

<must_do>
{{mustDo}}
</must_do>

<must_not_do>
{{mustNotDo}}
</must_not_do>

<uploaded_document_metadata_json>
{{documentsJson}}
</uploaded_document_metadata_json>

<required_sections>
- Formal implementation plan
- Plan adherence checkpoint
- Budget used
- Search intents
- Verified facts
- Source candidates to verify
- Route/appellation entities
- Travel advisory gaps
- Voice moments and conversation atmosphere
- Scenario drills for the teacher
- Suggested RAG/KG additions
</required_sections>
