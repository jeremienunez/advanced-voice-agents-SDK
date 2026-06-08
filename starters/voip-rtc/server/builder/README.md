# Builder Server Map

The builder server turns a guided UI session into a compiled voice agent. The top-level files coordinate workflows; nested folders own narrow responsibilities.

- `domain/` contains pure planning and validation logic split by subdomain: infra, database, knowledge, prompt, research, drafts, shared, and tooling.
- `adapters/` contains concrete LLM, Postgres, infra, document, embedding, and source adapters.
- `request/` contains request parsing and normalization.
- `state/` contains session, draft, ownership, and agent-bank persistence helpers.
- `llm/` contains provider resolution and task-running support.
- `prompts/` contains prompt templates and prompt data helpers.
- `onboarding/` contains environment and dependency setup routes.
- `workflows.ts` and `workflow-*.ts` coordinate the major builder stages.

Prefer putting deterministic business rules in `domain/` and concrete IO in `adapters/` or route/service layers.
