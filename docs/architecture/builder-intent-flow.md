# Builder Intent Flow (`/set goal` Equivalent)

This codebase does not implement a literal `/set goal` slash command, route, or
parser. The implemented equivalent is the builder identity field
`identity.intent`, exposed in the VOIP RTC starter UI as `Main intent`.

Use this document when tracing how a user-defined agent goal moves from the
starter UI into the SDK draft, the compiled prompt, and the voice runtime.

## Source Of Truth

- SDK type: `AgentBuilderIdentity.intent` in `src/sdk/types/builder.ts`
- SDK draft builder: `AgentBuildDraftBuilder` in `src/sdk/builders/draft.ts`
- Starter UI field: `Main intent` in
  `starters/voip-rtc/src/features/builder/components/IdentityIntentPanel.tsx`
- Browser API client: `createPromptPlan()` in
  `starters/voip-rtc/src/api/builderApi.ts`
- Server route: `POST /builder/prompt-plan` in
  `starters/voip-rtc/server/builder/router.ts`
- Request normalization: `normalizeIdentity()` in
  `starters/voip-rtc/server/builder/request/identity.ts`
- Builder workflow: `createPromptPlan()` in
  `starters/voip-rtc/server/builder/workflows.ts`
- Prompt fallback and artifact compilation:
  `starters/voip-rtc/server/builder/domain/prompt/plan.ts`
- Runtime voice injection:
  `starters/voip-rtc/server/voice/service.ts`

## Terminology Mapping

`/set goal` is not a runtime concept in this repository. The actual names are:

| User-facing concept | Code concept | Storage/transport field |
| --- | --- | --- |
| Goal | Main intent | `identity.intent` |
| Agent name | Public agent name | `identity.publicAgentName` |
| Required behavior | Must do | `identity.mustDo` |
| Forbidden behavior | Must never do | `identity.mustNotDo` |
| Builder model selection | Builder LLM | `identity.llmProvider`, `identity.llmModel` |

The "goal" therefore becomes `draft.identity.intent` once a builder draft is
created.

## Exact Flow

1. The starter renders the `Main intent` textarea in
   `IdentityIntentPanel.tsx`. Changes update the local `BuilderIdentity.intent`
   form field.

2. `deriveBuilderState()` enables `Analyze intent` only when
   `builderFirstName`, `builderLastName`, `publicAgentName`, and `intent` are
   all non-empty after trimming.

3. `useBuilderPromptPlanning().analyzeIntent()` calls
   `createPromptPlan(apiBase, form)`.

4. `createPromptPlan()` sends:

   ```json
   {
     "identity": {
       "builderFirstName": "...",
       "builderLastName": "...",
       "publicAgentName": "...",
       "intent": "...",
       "mustDo": "...",
       "mustNotDo": "...",
       "llmProvider": "...",
       "llmModel": "..."
     }
   }
   ```

   to `POST /builder/prompt-plan`.

5. The Bun server in `starters/voip-rtc/server/index.ts` forwards every
   `/builder/*` request to `builderService.handle()`.

6. `createBuilderRouter()` maps `POST /builder/prompt-plan` to
   `workflows.createPromptPlan(await request.json())`.

7. `normalizeIdentity()` reads either `body.identity` or the root body. It
   requires `builderFirstName`, `builderLastName`, `publicAgentName`, and
   `intent`. Missing values raise:

   ```text
   Missing required builder fields: ...
   ```

   It also converts `mustDo` and `mustNotDo` into string arrays.

8. The workflow creates a draft with:

   ```ts
   createAgentBuildDraftBuilder(draftId, identity)
   ```

   The SDK builder validates again during `build()`: `publicAgentName` and
   `intent` must be present, and duplicate tool registry names are rejected.

9. The planner receives the draft through
   `deps.planner.createPromptPlan({ draft })`. The DeepSeek planner uses
   `input.draft.identity.llmModel`; if no API key is configured or the request
   fails, it returns the local fallback prompt plan.

10. The fallback prompt plan writes the intent directly into `promptPart1`:

    ```text
    Intent principal: ${identity.intent}
    ```

11. The updated draft is saved by `saveDraft(nextDraft)`. In the starter this
    persists to `.builder-state/drafts.json` under the current working
    directory. This persistence is starter-side, not core SDK persistence.

12. Later, `POST /builder/compile-agent` calls `compileAgent()`. It composes the
    final prompt, creates a `CompiledAgentArtifact`, saves the compiled draft,
    and activates it with `setActiveDraft(nextDraft.id)`.

13. When the RTC lab starts a voice session, the browser sends
    `session.start` with the selected `agent` draft id.

14. `createStarterVoiceService()` resolves the compiled artifact through
    `builderService.getCompiledArtifact(agentId)`.

15. If a compiled prompt exists, `instructionsForRequest()` returns that prompt
    as the realtime provider instructions. If not, it falls back to the base
    starter SDK prompt from `sdk.promptFor({ channel: "voice" })`.

16. The realtime transport receives those instructions when the provider is
    created. From that point, the voice runtime consumes the compiled goal; it
    does not mutate or re-parse `identity.intent`.

## Core SDK Boundary

The core SDK owns the declarative contracts and builders:

- `AgentBuilderIdentity.intent`
- `AgentBuildDraft`
- `AgentBuildDraftBuilder`
- `PromptBuildPlan`
- `CompiledAgentArtifact`
- `compileVoiceAgentSdk()`

The core SDK does not expose HTTP routes, slash commands, draft file storage, or
the VOIP RTC builder UI. Those belong to `starters/voip-rtc`.

## Voice Runtime Boundary

The voice runtime owns sessions, media, transports, and tool execution:

- Browser client: `src/client/browser`
- Browser WebSocket service: `src/server/browser`
- Realtime session: `src/server/agent/sessions/voice-session.ts`
- Provider transports: `src/server/agent/transports`

The runtime receives provider instructions that may contain the compiled
intent. It has no `/set goal` handler and no `intent` setter during an active
session.

## Related Routes

- `POST /builder/prompt-plan`: creates the draft and prompt plan from
  `identity.intent`.
- `POST /builder/prompt-clarifications`: appends accepted clarification answers
  into the prompt plan.
- `POST /builder/knowledge-plan`: plans knowledge based on the current draft and
  documents.
- `POST /builder/database-plan`: plans the database/schema for knowledge.
- `POST /builder/compile-knowledge`: compiles knowledge chunks and embeddings.
- `POST /builder/compile-agent`: compiles the final agent artifact and activates
  the draft.
- `GET /builder/session`: returns the active compiled draft summary.
- `POST /builder/session`: activates an already compiled draft.
- `GET /builder/agents`: returns draft and compiled agent summaries.
- `GET /builder/drafts/:draftId`: returns one persisted draft.

## Current Gaps

- No literal `/set goal`, `/set-goal`, `set_goal`, or `setGoal` implementation
  exists in the source tree.
- No slash-command parser exists in the browser client, builder API, SMS
  transport, or voice runtime.
- There are no focused unit tests for `normalizeIdentity()` or
  `createPromptPlan()`. The route is exercised indirectly by the route-wines
  harness.
- The compiled artifact currently uses a Gemini preview provider definition in
  `compileArtifact()`, while runtime session provider selection is resolved by
  the starter voice service and the provider catalog.

## Verification Commands

```bash
rg -n "set goal|set_goal|/set goal|/set-goal|setGoal" src starters examples -g '!*.md'
pnpm typecheck:sdk
pnpm typecheck:starters
pnpm dev:voip-rtc
```
