import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const maxLoc = Number(process.env.AUDIT_LOC_MAX ?? 300);
const roots = ["src", "starters", "examples", "scripts"];
const extensions = new Set([".ts", ".tsx", ".css", ".mjs"]);
const excludedSegments = new Set([
  ".builder-state",
  ".git",
  ".playwright-mcp",
  "coverage",
  "dist",
  "node_modules",
]);
const generatedNamePatterns = [
  /\.d\.ts$/,
  /\.generated\./,
  /\.gen\./,
];

const offenders = [];

for (const directory of roots) {
  scan(join(root, directory));
}

if (offenders.length > 0) {
  console.error(
    `LOC audit failed: ${offenders.length} handwritten files exceed ${maxLoc} LOC.`,
  );
  for (const offender of offenders) {
    console.error(`${String(offender.lines).padStart(5)} ${offender.path}`);
  }
  process.exit(1);
}

console.log(`LOC audit clean: all handwritten files are <= ${maxLoc} LOC`);

function scan(path) {
  let info;
  try {
    info = statSync(path);
  } catch {
    return;
  }

  if (info.isDirectory()) {
    const name = path.split("/").at(-1);
    if (name && excludedSegments.has(name)) return;
    for (const item of readdirSync(path)) {
      scan(join(path, item));
    }
    return;
  }

  if (!info.isFile() || !isAuditedFile(path)) return;
  const lines = countLines(path);
  if (lines > maxLoc) {
    offenders.push({
      path: relative(root, path),
      lines,
    });
  }
}

function isAuditedFile(path) {
  if (generatedNamePatterns.some((pattern) => pattern.test(path))) return false;
  for (const segment of path.split("/")) {
    if (excludedSegments.has(segment)) return false;
  }
  return extensions.has(fileExtension(path));
}

function fileExtension(path) {
  if (path.endsWith(".tsx")) return ".tsx";
  if (path.endsWith(".mjs")) return ".mjs";
  if (path.endsWith(".css")) return ".css";
  if (path.endsWith(".ts")) return ".ts";
  return "";
}

function countLines(path) {
  const text = readFileSync(path, "utf8");
  if (!text) return 0;
  return text.endsWith("\n")
    ? text.split("\n").length - 1
    : text.split("\n").length;
}
