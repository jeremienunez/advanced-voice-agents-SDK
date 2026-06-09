import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sourceRoot = "src/sdk/types";
const rootFacadeFiles = new Set([
  "core.ts",
  "infra.ts",
  "learning.ts",
  "learning-loop.ts",
  "ports.ts",
  "runtime-ports.ts",
]);

const maximumDetailedContractLines = 180;
const maximumRootFacadeLines = 40;
const maximumIndexLines = 80;

const violations: string[] = [];

for (const file of listTypeScriptFiles(sourceRoot)) {
  const lineCount = countLines(file);
  const relativePath = file;
  const isRootFile = !file.slice(sourceRoot.length + 1).includes("/");
  const fileName = file.split("/").at(-1) ?? file;

  if (isRootFile && rootFacadeFiles.has(fileName)) {
    assertMaximum(
      relativePath,
      lineCount,
      maximumRootFacadeLines,
      "root SDK type domain should be a short facade",
    );
    continue;
  }

  if (fileName === "index.ts") {
    assertMaximum(
      relativePath,
      lineCount,
      maximumIndexLines,
      "SDK type domain index should stay navigational",
    );
    continue;
  }

  assertMaximum(
    relativePath,
    lineCount,
    maximumDetailedContractLines,
    "SDK type contract file is too broad",
  );
}

if (violations.length > 0) {
  console.error("SDK type domain audit violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("SDK type domain audit clean");

function listTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listTypeScriptFiles(path));
      continue;
    }
    if (path.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}

function countLines(file: string): number {
  const text = readFileSync(file, "utf8");
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function assertMaximum(
  file: string,
  actual: number,
  maximum: number,
  reason: string,
): void {
  if (actual <= maximum) return;
  violations.push(`${file} has ${actual} lines, max ${maximum}: ${reason}`);
}
