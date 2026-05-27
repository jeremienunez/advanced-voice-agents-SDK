import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const statePath = join(
  process.cwd(),
  "starters/voip-rtc/.builder-state/drafts.json",
);

const allowedHandlers = new Set([
  "knowledge.search",
  "summary.create",
  "handoff.create",
  "task.schedule",
  "event.emit",
]);

const issues = [];
let checked = 0;
let skippedLegacy = 0;

if (existsSync(statePath)) {
  for (const draft of readDrafts(statePath)) {
    if (!draft.compiled) continue;
    if (!draft.toolBuildPlan) {
      skippedLegacy += 1;
      continue;
    }
    checked += 1;
    auditCompiledDraft(draft);
  }
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`tool-contracts: ${issue}`);
  process.exit(1);
}

console.log(
  `tool-contracts: OK (${checked} compiled drafts checked, ${skippedLegacy} legacy skipped)`,
);

function readDrafts(path) {
  const payload = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(payload) ? payload : [];
}

function auditCompiledDraft(draft) {
  const plan = draft.toolBuildPlan;
  const selected = new Set(draft.selectedTools ?? []);
  const contracts = new Map((plan.tools ?? []).map((tool) => [tool.name, tool]));
  const compiled = new Map(
    (draft.compiled.sdkDefinition?.tools ?? []).map((tool) => [tool.name, tool]),
  );

  for (const name of selected) {
    const contract = contracts.get(name);
    if (!contract) {
      issues.push(`${draft.id}: selected tool ${name} has no contract`);
      continue;
    }
    auditContract(draft.id, contract);
    const compiledTool = compiled.get(name);
    if (!compiledTool) {
      issues.push(`${draft.id}: selected tool ${name} missing from artifact`);
      continue;
    }
    auditCompiledTool(draft.id, compiledTool, contract);
  }
}

function auditContract(draftId, contract) {
  if (contract.selected !== true) {
    issues.push(`${draftId}: ${contract.name} contract is not selected`);
  }
  if (contract.readiness !== "ready") {
    issues.push(`${draftId}: ${contract.name} is ${contract.readiness}`);
  }
  const handlerRef = contract.runtimeBinding?.handlerRef;
  if (!allowedHandlers.has(handlerRef)) {
    issues.push(`${draftId}: ${contract.name} invalid handler ${handlerRef}`);
  }
  if (contract.parameters?.type !== "object") {
    issues.push(`${draftId}: ${contract.name} parameters are not object schema`);
  }
  if (needsConfirmation(contract) && !contract.confirmation?.required) {
    issues.push(`${draftId}: ${contract.name} needs confirmation`);
  }
}

function auditCompiledTool(draftId, tool, contract) {
  if (tool.handlerRef !== contract.runtimeBinding.handlerRef) {
    issues.push(`${draftId}: ${tool.name} handler mismatch`);
  }
  if (tool.parameters?.type !== "object") {
    issues.push(`${draftId}: ${tool.name} artifact schema is not object`);
  }
  if (needsConfirmation(contract) && tool.executionMode !== "confirmation") {
    issues.push(`${draftId}: ${tool.name} artifact must require confirmation`);
  }
}

function needsConfirmation(tool) {
  return ["write", "external_action", "handoff"].includes(tool.sideEffect);
}
