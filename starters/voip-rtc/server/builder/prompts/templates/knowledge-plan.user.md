<task>
Create knowledge planning JSON for the voice-agent draft and documents.
</task>

<allowed_strategy_values>
- vector
- lexical
- hybrid
- raptor
- kg
- hybrid_kg
</allowed_strategy_values>

<rules>
- Use lexical only for Postgres FTS, not BM25.
- Prefer hybrid or hybrid_kg when structured documents and natural-language answers both matter.
- Keep every recommendation grounded in the agent intent and uploaded/researched document metadata.
- Use `vector` indexes for embeddings, `lexical` indexes for Postgres FTS, and `graph` indexes only for KG support.
- Keep chunks small enough for spoken answers: usually 320-520 target tokens with 48-96 overlap tokens.
- Set `validationRequired` to true unless the document set is tiny, explicit, and fully trusted.
- Preserve all input documents in `documents`; only change status to reflect planning.
- Put unsupported files, parser gaps, missing source metadata, or weak coverage in `warnings`.
</rules>

<output_contract>
Return this exact shape:
{
  "strategy": "hybrid",
  "alternativeStrategies": ["vector"],
  "documents": [],
  "chunking": {"method": "semantic", "targetTokens": 420, "overlapTokens": 72, "rationale": "string"},
  "indexes": [{"id": "string", "kind": "vector", "fields": ["embedding"], "metric": "cosine", "dimensions": 1024, "implementation": "pgvector hnsw"}],
  "kg": {"enabled": false, "entityTypes": [], "relationTypes": [], "rationale": "string"},
  "reasons": ["string"],
  "validationRequired": true,
  "warnings": ["string"]
}
</output_contract>

<draft_identity_json>
{{draftIdentityJson}}
</draft_identity_json>

<documents_json>
{{documentSummaryJson}}
</documents_json>
