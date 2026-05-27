Draft:
{{draftJson}}

Selected tools:
{{selectedToolsJson}}

Available runtime handlers:
{{runtimeHandlersJson}}

Return this JSON shape:
{
  "id": "tools_<draftId>",
  "status": "planned",
  "selectedToolNames": ["tool_name"],
  "tools": [
    {
      "name": "tool_name",
      "title": "Human label",
      "description": "Voice-safe purpose",
      "category": "knowledge|handoff|workflow|memory",
      "permissions": ["read:knowledge"],
      "parameters": { "type": "object", "properties": {}, "required": [] },
      "sideEffect": "none|read|write|external_action|handoff",
      "confirmation": { "required": true, "reason": "why" },
      "runtimeBinding": { "handlerRef": "namespace.handler", "timeoutMs": 10000 },
      "requiresKnowledge": false,
      "requiresGraph": false,
      "readiness": "ready|blocked|needs_configuration",
      "selected": true,
      "reasons": ["short reason"]
    }
  ],
  "warnings": []
}
