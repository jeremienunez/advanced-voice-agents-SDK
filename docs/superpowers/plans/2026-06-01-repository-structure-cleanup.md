# Repository Structure Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository tree easier to scan while preserving the published SDK package surface and existing CI gates.

**Architecture:** Keep runtime source under the existing `src/sdk`, `src/server`, and `src/client` package boundaries because they map directly to `package.json` exports. Restructure the root tooling area by responsibility: audits, BDD scenarios, smoke checks, type tests, and reusable helper modules.

**Tech Stack:** TypeScript, Bun script runners, Node ESM, pnpm workspaces, dependency-cruiser, npm package `exports` and `files`.

---

### Task 1: Move Root Tooling Into Responsibility Folders

**Files:**
- Move: `scripts/audit-*.mjs` and `scripts/audit-secret-hygiene.ts` to `scripts/audits/`
- Move: `scripts/test-*-bdd.ts` to `scripts/bdd/`
- Move: `scripts/test-runtime-tool-call.ts` to `scripts/smoke/`
- Keep: `scripts/type-tests/`, `scripts/secret-hygiene/`, `scripts/agentrx-diagnostics/`
- Modify: `package.json`

- [ ] **Step 1: Create target folders**

Run:

```bash
mkdir -p scripts/audits scripts/bdd scripts/smoke
```

- [ ] **Step 2: Move tracked files**

Run:

```bash
git mv scripts/audit-core-imports.mjs scripts/audits/audit-core-imports.mjs
git mv scripts/audit-loc.mjs scripts/audits/audit-loc.mjs
git mv scripts/audit-responsibility.mjs scripts/audits/audit-responsibility.mjs
git mv scripts/audit-sdk-boundary.mjs scripts/audits/audit-sdk-boundary.mjs
git mv scripts/audit-secret-hygiene.ts scripts/audits/audit-secret-hygiene.ts
git mv scripts/audit-tool-contracts.mjs scripts/audits/audit-tool-contracts.mjs
git mv scripts/test-adaptive-learning-loop-core-bdd.ts scripts/bdd/test-adaptive-learning-loop-core-bdd.ts
git mv scripts/test-adaptive-learning-loop-receipts-bdd.ts scripts/bdd/test-adaptive-learning-loop-receipts-bdd.ts
git mv scripts/test-agentrx-diagnostics-bdd.ts scripts/bdd/test-agentrx-diagnostics-bdd.ts
git mv scripts/test-debug-audio-dump-bdd.ts scripts/bdd/test-debug-audio-dump-bdd.ts
git mv scripts/test-fastify-voice-adapter-bdd.ts scripts/bdd/test-fastify-voice-adapter-bdd.ts
git mv scripts/test-log-redaction-bdd.ts scripts/bdd/test-log-redaction-bdd.ts
git mv scripts/test-package-metadata-bdd.ts scripts/bdd/test-package-metadata-bdd.ts
git mv scripts/test-public-boundaries-bdd.ts scripts/bdd/test-public-boundaries-bdd.ts
git mv scripts/test-secret-hygiene-bdd.ts scripts/bdd/test-secret-hygiene-bdd.ts
git mv scripts/test-runtime-tool-call.ts scripts/smoke/test-runtime-tool-call.ts
```

- [ ] **Step 3: Update moved script imports**

Replace root-relative imports in moved BDD files:

```bash
perl -pi -e 's#from "\.\./src/#from "../../src/#g; s#from "\./secret-hygiene/#from "../secret-hygiene/#g; s#from "\./agentrx-diagnostics/#from "../agentrx-diagnostics/#g; s#from "\.\./starters/#from "../../starters/#g' scripts/bdd/*.ts
perl -pi -e 's#from "\./secret-hygiene/#from "../secret-hygiene/#g' scripts/audits/audit-secret-hygiene.ts
```

- [ ] **Step 4: Update `package.json` script paths**

Change root test and audit commands from `scripts/test-...` and `scripts/audit-...` to `scripts/bdd/...`, `scripts/smoke/...`, and `scripts/audits/...`.

- [ ] **Step 5: Verify no old executable paths remain**

Run:

```bash
rg -n "scripts/(test-|audit-)" package.json README.md CHANGELOG.md TODO.md APP_OWNED_INTEGRATION.md RELEASE_ALPHA.md .github scripts starters/voip-rtc
```

Expected: no root-level `scripts/test-...` or `scripts/audit-...` paths, except historical changelog text if intentionally kept.

### Task 2: Document the Target Tree

**Files:**
- Modify: `README.md`
- Create: `REPO_STRUCTURE.md`

- [ ] **Step 1: Add a concise repository structure document**

Create `REPO_STRUCTURE.md` with the canonical top-level tree, ownership rules, and package publication boundaries.

- [ ] **Step 2: Update README Repository Map**

Update the `scripts` row to mention `scripts/audits`, `scripts/bdd`, `scripts/smoke`, and helper folders.

### Task 3: Run Gates and Commit

**Files:**
- Modify only paths moved or docs touched above.

- [ ] **Step 1: Run structure-level checks**

Run:

```bash
pnpm audit:architecture
pnpm audit:responsibility
pnpm audit:loc
pnpm test:public-boundaries:bdd
pnpm test:package-metadata:bdd
```

- [ ] **Step 2: Run release gates**

Run:

```bash
pnpm audit:solid
pnpm pack:dry-run
git diff --check
```

- [ ] **Step 3: Commit and push**

Run:

```bash
git status --short
git add package.json README.md REPO_STRUCTURE.md scripts docs/superpowers/plans/2026-06-01-repository-structure-cleanup.md
git commit -m "chore: organize repository tooling"
git push
```
