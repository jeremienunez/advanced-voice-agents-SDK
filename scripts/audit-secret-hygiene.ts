#!/usr/bin/env bun

import {
  auditSecretHygiene,
} from "./secret-hygiene/audit.ts";

const includeLocalEnv = process.env.AUDIT_LOCAL_ENV_SECRETS === "1";
const result = auditSecretHygiene({
  root: process.cwd(),
  includeLocalEnv,
});

if (!result.ok) {
  console.error(JSON.stringify({
    status: "error",
    scannedFiles: result.scannedFiles,
    includeLocalEnv,
    findings: result.findings,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  scannedFiles: result.scannedFiles,
  includeLocalEnv,
}, null, 2));
