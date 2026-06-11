# Alpha Release Procedure

This repo publishes the SDK core as `@voiceagentsdk/core`. The VOIP RTC starter
is a reference integration and is not included in the npm package tarball.

## Versioning

Use prerelease versions for the first public alpha line:

```bash
pnpm version 0.1.0-alpha.1 --no-git-tag-version
```

Increment the suffix for follow-up alpha builds: `0.1.0-alpha.1`,
`0.1.0-alpha.2`, and so on.

## Alpha Breaking Changes

Before publishing, confirm builder drafts use the separated SDK contract:
agent identity fields must not carry builder LLM provider/model choices.
Creation-system model choices live under `builderSystem.modelSelections`.

## Required Checks

Run the full local release gate before publishing:

```bash
pnpm audit:solid
pnpm pack:dry-run
```

For a narrower package check during iteration:

```bash
pnpm build
pnpm test:public-boundaries:bdd
pnpm test:package-metadata:bdd
pnpm pack:dry-run
```

Inspect the dry-run output and confirm it contains only package-level artifacts:

- `dist`;
- `README.md`;
- `CHANGELOG.md`;
- `TODO.md`;
- `LICENSE`;
- `package.json`.

It must not include `starters/`, local env files, generated builder state, or
workspace-only examples.

## Publish

Publish alpha builds with the npm alpha tag:

```bash
npm publish --tag alpha
```

If GitHub trusted publishing or provenance is enabled later, keep the same
validation steps and move the publish command into the release workflow.

## Post-Publish Smoke

In a clean temporary project:

```bash
pnpm init
pnpm add @voiceagentsdk/core@alpha
```

Then verify imports compile:

```ts
import { createAgentBuilder } from "@voiceagentsdk/core/sdk";
import { createBrowserVoiceService } from "@voiceagentsdk/core/server/browser";
import { createVoiceWSClient } from "@voiceagentsdk/core/client/browser";

void createAgentBuilder;
void createBrowserVoiceService;
void createVoiceWSClient;
```
