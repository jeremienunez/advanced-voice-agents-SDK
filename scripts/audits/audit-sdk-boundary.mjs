#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const sdkRoot = join(root, "src/sdk");

const forbidden = [
  "gaspard",
  "oino",
  "wine",
  "cave",
  "sommelier",
  "investment",
  "appellation",
  "terroir",
  "portfolio",
  "@gaspard",
  "@gaspard/db-schema",
  "@gaspard/shared",
];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (/\.(ts|tsx|md|mjs|json)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const files = await listFiles(sdkRoot);
const violations = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  const lower = content.toLowerCase();
  for (const term of forbidden) {
    if (lower.includes(term.toLowerCase())) {
      violations.push({ file, term });
    }
  }
}

if (violations.length > 0) {
  console.error("SDK boundary violations:");
  for (const violation of violations) {
    console.error(
      `- ${relative(root, violation.file)}: ${violation.term}`,
    );
  }
  process.exit(1);
}

console.log(`SDK boundary clean: ${files.length} files scanned`);
