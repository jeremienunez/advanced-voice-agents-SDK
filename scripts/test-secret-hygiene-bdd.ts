import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditSecretHygiene,
} from "./secret-hygiene/audit.ts";

const results = [
  scenarioCommittedScanReportsSecretsWithoutLeakingValues(),
  scenarioLocalEnvScanIsExplicitOptIn(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioCommittedScanReportsSecretsWithoutLeakingValues(): string {
  const root = mkdtempSync(join(tmpdir(), "secret-hygiene-committed-"));
  const rawSecret = ["sk", "live", "secret", "value", "1234567890abcdef"]
    .join("-");

  try {
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "config.ts"),
      `export const token = "${rawSecret}";\n`,
    );

    const result = auditSecretHygiene({
      root,
      files: ["src/config.ts"],
      includeLocalEnv: false,
    });
    const serialized = JSON.stringify(result);

    assert(!result.ok, "committed live-like secret must fail audit");
    assert(
      result.findings[0]?.file === "src/config.ts",
      "finding must include the file path",
    );
    assert(
      !serialized.includes(rawSecret),
      "audit output must never include raw secret values",
    );
    assert(
      serialized.includes("[redacted-secret]"),
      "audit output must include a redacted marker",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  return "committed-secret-redacted";
}

function scenarioLocalEnvScanIsExplicitOptIn(): string {
  const root = mkdtempSync(join(tmpdir(), "secret-hygiene-local-"));
  const rawSecret = ["provider", "local", "secret", "value", "1234567890abcdef"]
    .join("-");

  try {
    writeFileSync(join(root, ".env"), `GEMINI_API_KEY=${rawSecret}\n`);
    writeFileSync(join(root, ".env.example"), "GEMINI_API_KEY=...\n");

    const defaultResult = auditSecretHygiene({
      root,
      files: [".env.example"],
      includeLocalEnv: false,
    });
    const localResult = auditSecretHygiene({
      root,
      files: [".env.example"],
      includeLocalEnv: true,
    });
    const serialized = JSON.stringify(localResult);

    assert(defaultResult.ok, "default audit must ignore local env files");
    assert(!localResult.ok, "explicit local env audit must report live-like env secrets");
    assert(
      localResult.findings.some((finding) => finding.key === "GEMINI_API_KEY"),
      "local env finding must include secret key name",
    );
    assert(
      !serialized.includes(rawSecret),
      "local env audit output must never include raw secret values",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  return "local-env-secret-audit-opt-in";
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
