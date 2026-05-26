#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const scanRoot = join(root, "src");

const forbidden = [
  "@gaspard",
  "oino",
  "gaspard",
  "wine",
  "cave",
  "investment",
  "sommelier",
  "appellation",
  "terroir",
  "portfolio",
  "from \"@/",
  "from '@/",
];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(file)));
    } else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) {
      files.push(file);
    }
  }

  return files;
}

const violations = [];

for (const file of await listFiles(scanRoot)) {
  const content = await readFile(file, "utf8");
  const lower = content.toLowerCase();

  for (const term of forbidden) {
    if (lower.includes(term.toLowerCase())) {
      violations.push({
        file: relative(root, file),
        term,
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Core import/domain boundary violations:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.term}`);
  }
  process.exit(1);
}

console.log("Core import/domain boundary clean");
