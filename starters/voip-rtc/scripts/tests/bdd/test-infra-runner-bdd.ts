import type { InfraIacBundle } from "@voiceagentsdk/core/sdk";
import { chooseInfraApplyPath } from "../../infra/apply-policy.js";
import {
  runExternalInfraRunner,
  type ExternalInfraCommand,
} from "../../infra/external-runner.js";
import { assert, assertThrows } from "../shared/assertions.js";

const results = [
  scenarioCliApplyPolicyDoesNotFallbackToDevLocal(),
  await scenarioOpenTofuPlanUsesAllowlistedEnv(),
  await scenarioVmApplyValidatesCloudInitThenAppliesTofu(),
  await scenarioExternalRunnerRefusesUnsafeTargets(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioCliApplyPolicyDoesNotFallbackToDevLocal(): string {
  assert(
    chooseInfraApplyPath({ driver: "dev-local", target: "local" }) === "dev-local",
    "dev-local driver must own local target applies",
  );
  assert(
    chooseInfraApplyPath({ driver: "external", target: "managed" }) === "external",
    "external driver must own managed target applies",
  );
  assertThrows(
    () => chooseInfraApplyPath({ driver: "external", target: "local" }),
    "External infra runner cannot apply local targets",
  );

  return "cli-apply-policy-refuses-external-local-fallback";
}

async function scenarioOpenTofuPlanUsesAllowlistedEnv(): Promise<string> {
  const calls: ExternalInfraCommand[] = [];
  const result = await runExternalInfraRunner({
    action: "plan",
    bundle: vmBundle(),
    outputDir: "/tmp/voiceagentsdk-iac/draft-a",
    env: {
      PATH: "/usr/bin",
      HOME: "/home/tester",
      BUILDER_INFRA_TOFU_MODULE_DIR: "/workspace/infra/tofu",
      GEMINI_API_KEY: "must-not-be-forwarded",
    },
    execute: async (command) => {
      calls.push(command);
      return { exitCode: 0, stdout: "ok", stderr: "" };
    },
  });

  assert(result.status === "planned", "plan action must return planned status");
  assert(calls.length === 2, "tofu plan must run init and plan");
  assert(calls[0].args.includes("init"), "first tofu command must init");
  assert(calls[1].args.includes("plan"), "second tofu command must plan");
  assert(
    calls.every((call) => !("GEMINI_API_KEY" in call.env)),
    "external runner must not forward provider secrets",
  );
  assert(
    calls.every((call) => call.env.TF_IN_AUTOMATION === "1"),
    "external runner must mark Terraform automation",
  );

  return "opentofu-plan-allowlisted-env";
}

async function scenarioVmApplyValidatesCloudInitThenAppliesTofu(): Promise<string> {
  const calls: ExternalInfraCommand[] = [];
  const result = await runExternalInfraRunner({
    action: "apply",
    bundle: vmBundle(),
    outputDir: "/tmp/voiceagentsdk-iac/draft-a",
    env: {
      PATH: "/usr/bin",
      BUILDER_INFRA_TOFU_MODULE_DIR: "/workspace/infra/tofu",
    },
    execute: async (command) => {
      calls.push(command);
      return { exitCode: 0, stdout: "ok", stderr: "" };
    },
  });

  assert(result.status === "applied", "apply action must return applied status");
  assert(calls.length === 3, "vm apply must validate cloud-init and run tofu");
  assert(calls[0].command === "cloud-init", "vm apply must validate cloud-init first");
  assert(calls[1].args.includes("init"), "vm apply must initialize OpenTofu");
  assert(calls[2].args.includes("apply"), "vm apply must run OpenTofu apply");
  assert(
    calls[2].args.includes("-auto-approve"),
    "OpenTofu apply must be explicit non-interactive",
  );

  return "vm-apply-cloud-init-and-opentofu";
}

async function scenarioExternalRunnerRefusesUnsafeTargets(): Promise<string> {
  await assertRejects(
    () => runExternalInfraRunner({
      action: "destroy",
      bundle: vmBundle(),
      outputDir: "/tmp/voiceagentsdk-iac/draft-a",
      env: { BUILDER_INFRA_TOFU_MODULE_DIR: "/workspace/infra/tofu" },
      execute: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    }),
    "External infra runner does not support destroy",
  );
  await assertRejects(
    () => runExternalInfraRunner({
      action: "apply",
      bundle: { ...vmBundle(), target: "local" },
      outputDir: "/tmp/voiceagentsdk-iac/draft-a",
      env: { BUILDER_INFRA_TOFU_MODULE_DIR: "/workspace/infra/tofu" },
      execute: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    }),
    "External infra runner cannot apply local targets",
  );

  return "external-runner-refuses-unsafe-targets";
}

function vmBundle(): InfraIacBundle {
  return {
    id: "iac_test",
    planId: "infra_test",
    target: "vm",
    applyMode: "external",
    generatedAt: new Date(0).toISOString(),
    notes: [],
    artifacts: [
      {
        path: "agent-infra.plan.json",
        kind: "plan",
        dialect: "json-plan",
        contentType: "application/json",
        content: "{}",
        sensitive: false,
        description: "plan",
      },
      {
        path: "vm/agent.auto.tfvars.json",
        kind: "variables",
        dialect: "opentofu",
        contentType: "application/json",
        content: "{}",
        sensitive: false,
        description: "variables",
      },
      {
        path: "vm/cloud-init.yaml",
        kind: "bootstrap",
        dialect: "cloud-init",
        contentType: "text/yaml",
        content: "#cloud-config",
        sensitive: false,
        description: "cloud init",
      },
    ],
  };
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes(expectedMessage),
      `expected error message to include "${expectedMessage}"`,
    );
    return;
  }
  assert(false, `expected action to reject "${expectedMessage}"`);
}
