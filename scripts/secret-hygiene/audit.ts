import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";

export interface SecretHygieneFinding {
  file: string;
  line: number;
  key?: string;
  kind: "env-secret" | "token-pattern" | "database-url";
  value: "[redacted-secret]";
}

export interface SecretHygieneResult {
  ok: boolean;
  scannedFiles: number;
  findings: SecretHygieneFinding[];
}

export interface SecretHygieneOptions {
  root: string;
  files?: string[];
  includeLocalEnv?: boolean;
}

const scanRoots = [
  ".env.example",
  "README.md",
  "CHANGELOG.md",
  "TODO.md",
  "package.json",
  "src",
  "starters/voip-rtc/.env.example",
  "starters/voip-rtc/README.md",
  "starters/voip-rtc/server",
  "starters/voip-rtc/scripts",
  "starters/voip-rtc/src",
  "scripts",
  "examples",
];

const localEnvFiles = [
  ".env",
  ".env.local",
  "starters/voip-rtc/.env",
  "starters/voip-rtc/.env.local",
];

const ignoredDirectories = new Set([
  ".git",
  ".builder-state",
  "dist",
  "node_modules",
]);

const scannedExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const secretKeyPattern = /(api[_-]?key|token|secret|password|credential)/i;
const tokenPattern = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/;
const highEntropySecretPattern = /^[A-Za-z0-9_-]{24,}$/;
const databaseUrlPattern = /\b(?:postgres(?:ql)?|redis):\/\/[^/\s:@]+:[^/\s@]+@/i;
const envAssignmentPattern = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
const redacted = "[redacted-secret]" as const;

export function auditSecretHygiene(
  options: SecretHygieneOptions,
): SecretHygieneResult {
  const files = collectFiles(options);
  const findings = files.flatMap((file) => inspectFile(options.root, file));

  return {
    ok: findings.length === 0,
    scannedFiles: files.length,
    findings,
  };
}

function collectFiles(options: SecretHygieneOptions): string[] {
  const roots = options.files ?? scanRoots;
  const files = roots.flatMap((item) => collectPath(options.root, item));
  if (options.includeLocalEnv) {
    files.push(...localEnvFiles.flatMap((item) => collectPath(options.root, item)));
  }
  return unique(files).sort();
}

function collectPath(root: string, path: string): string[] {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];

  const stat = statSync(absolute);
  if (stat.isDirectory()) return collectDirectory(absolute);
  if (!isScannableFile(absolute)) return [];
  return [absolute];
}

function collectDirectory(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) return [];
      return collectDirectory(absolute);
    }
    return isScannableFile(absolute) ? [absolute] : [];
  });
}

function isScannableFile(path: string): boolean {
  if (path.endsWith(".env") || path.includes(".env.")) return true;
  return scannedExtensions.has(path.slice(path.lastIndexOf(".")));
}

function inspectFile(root: string, file: string): SecretHygieneFinding[] {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) => inspectLine(relative(root, file), index + 1, line));
}

function inspectLine(
  file: string,
  lineNumber: number,
  line: string,
): SecretHygieneFinding[] {
  const env = line.trim().match(envAssignmentPattern);
  if (env) return inspectEnvLine(file, lineNumber, env[1], env[2]);

  const findings: SecretHygieneFinding[] = [];
  if (tokenPattern.test(line) && !isPlaceholder(line)) {
    findings.push(finding(file, lineNumber, "token-pattern"));
  }
  if (databaseUrlPattern.test(line) && !isLocalDatabaseLine(line)) {
    findings.push(finding(file, lineNumber, "database-url"));
  }
  return findings;
}

function inspectEnvLine(
  file: string,
  lineNumber: number,
  key: string,
  rawValue: string,
): SecretHygieneFinding[] {
  const value = stripQuotes(rawValue.trim());
  if (isPlaceholder(value)) return [];
  if (secretKeyPattern.test(key) && isLiveLikeSecretValue(value)) {
    return [finding(file, lineNumber, "env-secret", key)];
  }
  if (databaseUrlPattern.test(value) && !isLocalDatabaseLine(value)) {
    return [finding(file, lineNumber, "database-url", key)];
  }
  return [];
}

function isLiveLikeSecretValue(value: string): boolean {
  return tokenPattern.test(value) || highEntropySecretPattern.test(value);
}

function finding(
  file: string,
  line: number,
  kind: SecretHygieneFinding["kind"],
  key?: string,
): SecretHygieneFinding {
  return { file, line, kind, key, value: redacted };
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  return (
    normalized === "" ||
    normalized === "..." ||
    normalized.includes("...") ||
    /^(example|placeholder|changeme|dummy|test|local|dev-local)$/i.test(normalized)
  );
}

function isLocalDatabaseLine(value: string): boolean {
  return /:\/\/[^/\s:@]+:[^/\s@]+@(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i
    .test(value);
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
