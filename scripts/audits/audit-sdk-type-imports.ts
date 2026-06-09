import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import ts from "typescript";

const sdkRoot = normalize("src/sdk");
const publicTypeFacade = normalize("src/sdk/types.ts");
const allowedBroadTypeConsumers = new Set([
  normalize("src/sdk/index.ts"),
]);

const violations: string[] = [];

for (const file of listTypeScriptFiles(sdkRoot)) {
  if (file.startsWith(normalize("src/sdk/types/"))) continue;
  if (file === publicTypeFacade) continue;

  auditFile(file);
}

if (violations.length > 0) {
  console.error("SDK type import hygiene violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("SDK type import hygiene clean");

function auditFile(file: string): void {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of source.statements) {
    const moduleSpecifier = readModuleSpecifier(statement);
    if (!moduleSpecifier) continue;
    const resolved = resolveTypeScriptModule(file, moduleSpecifier);
    if (resolved !== publicTypeFacade) continue;
    if (allowedBroadTypeConsumers.has(file)) continue;
    violations.push(
      `${file} imports broad SDK type facade ${moduleSpecifier}; import from src/sdk/types/<domain>.js instead`,
    );
  }
}

function readModuleSpecifier(statement: ts.Statement): string | undefined {
  if (
    (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
    statement.moduleSpecifier &&
    ts.isStringLiteral(statement.moduleSpecifier)
  ) {
    return statement.moduleSpecifier.text;
  }
  return undefined;
}

function resolveTypeScriptModule(file: string, moduleSpecifier: string): string | undefined {
  if (!moduleSpecifier.startsWith(".")) return undefined;

  const withoutJs = moduleSpecifier.endsWith(".js")
    ? moduleSpecifier.slice(0, -3)
    : moduleSpecifier;
  const basePath = normalize(resolve(dirname(file), withoutJs));
  const cwd = normalize(process.cwd());
  const relativeBase = normalize(basePath.startsWith(cwd)
    ? basePath.slice(cwd.length + 1)
    : basePath);

  const direct = `${relativeBase}.ts`;
  if (statExists(direct)) return direct;

  const index = normalize(join(relativeBase, "index.ts"));
  if (statExists(index)) return index;

  return undefined;
}

function listTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const path = normalize(join(directory, entry));
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

function statExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
