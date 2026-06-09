import { readFileSync } from "node:fs";
import ts from "typescript";

import { publicApiEntries } from "../public-api/manifest.js";

interface PackageJson {
  exports?: Record<string, {
    types?: string;
    import?: string;
  }>;
}

interface SourceExports {
  values: string[];
  types: string[];
  starExports: string[];
  namespaceExports: string[];
}

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
const violations: string[] = [];

auditPackageExports();
auditSourceFacades();

if (violations.length > 0) {
  console.error("Public API audit violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Public API audit clean: ${publicApiEntries.length} entrypoints checked`);

function auditPackageExports(): void {
  const actual = Object.keys(pkg.exports ?? {}).sort();
  const expected = publicApiEntries.map((entry) => entry.exportPath).sort();
  compareLists("package.json exports", actual, expected);

  for (const entry of publicApiEntries) {
    const packageExport = pkg.exports?.[entry.exportPath];
    if (!packageExport) continue;
    if (packageExport.types !== entry.packageExport.types) {
      violations.push(
        `${entry.exportPath} types points to ${String(packageExport.types)}, expected ${entry.packageExport.types}`,
      );
    }
    if (packageExport.import !== entry.packageExport.import) {
      violations.push(
        `${entry.exportPath} import points to ${String(packageExport.import)}, expected ${entry.packageExport.import}`,
      );
    }
  }
}

function auditSourceFacades(): void {
  for (const entry of publicApiEntries) {
    const sourceExports = readSourceExports(entry.sourceFile);
    for (const moduleSpecifier of sourceExports.starExports) {
      violations.push(`${entry.sourceFile} uses export * from ${moduleSpecifier}`);
    }
    for (const moduleSpecifier of sourceExports.namespaceExports) {
      violations.push(`${entry.sourceFile} uses namespace export from ${moduleSpecifier}`);
    }
    compareLists(`${entry.sourceFile} value exports`, sourceExports.values, [...entry.values]);
    compareLists(`${entry.sourceFile} type exports`, sourceExports.types, [...entry.types]);
    assertForbidden(`${entry.sourceFile} value`, sourceExports.values, [...(entry.forbiddenValues ?? [])]);
    assertForbidden(`${entry.sourceFile} type`, sourceExports.types, [...(entry.forbiddenTypes ?? [])]);
  }
}

function readSourceExports(file: string): SourceExports {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const values = new Set<string>();
  const types = new Set<string>();
  const starExports: string[] = [];
  const namespaceExports: string[] = [];

  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const moduleSpecifier = readModuleSpecifier(statement);
    const exportClause = statement.exportClause;
    if (!exportClause) {
      starExports.push(moduleSpecifier);
      continue;
    }
    if (!ts.isNamedExports(exportClause)) {
      namespaceExports.push(moduleSpecifier);
      continue;
    }
    for (const specifier of exportClause.elements) {
      const target = statement.isTypeOnly || specifier.isTypeOnly ? types : values;
      target.add(specifier.name.text);
    }
  }

  return {
    values: [...values].sort(),
    types: [...types].sort(),
    starExports,
    namespaceExports,
  };
}

function readModuleSpecifier(statement: ts.ExportDeclaration): string {
  const moduleSpecifier = statement.moduleSpecifier;
  if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) return "<local>";
  return moduleSpecifier.text;
}

function compareLists(label: string, actual: string[], expected: string[]): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((name) => !actualSet.has(name));
  const unexpected = actual.filter((name) => !expectedSet.has(name));

  for (const name of missing) {
    violations.push(`${label} is missing ${name}`);
  }
  for (const name of unexpected) {
    violations.push(`${label} unexpectedly exports ${name}`);
  }
}

function assertForbidden(label: string, actual: string[], forbidden: string[]): void {
  const actualSet = new Set(actual);
  for (const name of forbidden) {
    if (actualSet.has(name)) {
      violations.push(`${label} exports forbidden symbol ${name}`);
    }
  }
}
