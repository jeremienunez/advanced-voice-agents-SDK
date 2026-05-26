<task>
Verify the current voice-agent knowledge base.
</task>

<output_contract>
Return this exact JSON shape:
{
  "status": "needs_more_data",
  "confidence": 0.82,
  "reasons": ["string"],
  "missingTopics": ["string"],
  "recommendedQueries": ["string"],
  "coverageMatrix": [
    {
      "topic": "string",
      "status": "covered | weak | missing",
      "evidence": ["string"],
      "followUp": ["string"]
    }
  ],
  "artifactTables": [
    {
      "name": "string",
      "purpose": "string",
      "recommendedFormat": "markdown | csv | xlsx",
      "columns": ["string"],
      "rows": [["string"]]
    }
  ],
  "enrichmentMarkdown": "string",
  "warnings": ["string"]
}
</output_contract>

<decision_rules>
- Use "sufficient" only if the agent can answer expected user questions with grounded, domain-appropriate context.
- Use "needs_more_data" when key procedures, policies, edge cases, sources, or repository fields are missing.
- Use "failed" only when the corpus is unusable or contradictory.
- Recommended queries must be concrete and domain-specific.
- Enrichment Markdown must be rich, operational, source-aware material. It should include procedures, decision rules, edge cases, citation policy, knowledge gaps, voice-ready teaching notes, scenario drills, and recovery phrases. Mark unsupported claims as "to verify".
- Use `coverageMatrix` to show exactly which topics are covered, weak, or missing.
- Use `artifactTables` for structured material that should later become XLSX/CSV rows: routes, procedures, policy rules, entity fields, repository records, FAQs, tool contracts, KG entities, conversation scenes, or evaluation rubrics.
- Do not shrink the answer to a small summary when the base needs teacher material.
- Confidence must be between 0 and 1.
- `reasons` must explain the verdict without hidden reasoning.
- `missingTopics` must be phrased as concrete knowledge gaps.
- `warnings` must call out source, freshness, contradiction, safety, or coverage risks.
</decision_rules>

<draft_json>
{{draftJson}}
</draft_json>

<research_json>
{{researchJson}}
</research_json>

<documents_json>
{{documentsJson}}
</documents_json>
