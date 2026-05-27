import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["src", "starters/voip-rtc/src", "starters/voip-rtc/server"];
const extensions = new Set([".ts", ".tsx", ".mjs", ".js"]);
const ignoredSegments = new Set(["node_modules", "dist", ".builder-state"]);
const vagueNames = new Set(["utils", "helpers", "common", "misc", "stuff", "manager"]);
const barrelPattern = /(^|\/)index\.(?:ts|tsx|mjs|js)$/;
const barrelOnlyNamePattern = /(^|\/)(?:index|utils|state|request|routing|protocol)\.(?:ts|tsx|mjs|js)$/;
const typeModulePattern = /(^|\/)(?:types|.*-types|.*\.types)\.(?:ts|tsx)$/;
const generatedTypeHubPattern = /^src\/sdk\/types\.ts$/;
const maxRuntimeExports = 5;
const allowedInheritanceBases = new Set(["Error", "AudioWorkletProcessor"]);
const permittedStarterServerRootFiles = new Set([
  "starters/voip-rtc/server/index.ts",
]);

const violations = [];

for (const file of scanFiles(process.cwd(), roots)) {
  const source = readFileSync(file, "utf8");
  const rel = normalize(relative(process.cwd(), file));
  inspectFile(rel, source);
}

if (violations.length > 0) {
  console.error("Responsibility audit failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.rule} - ${violation.message}`);
  }
  process.exit(1);
}

console.log("Responsibility audit clean: files keep one visible responsibility");

function inspectFile(file, source) {
  assertServerRootEntryPoint(file);
  assertBarrelOnlyFile(file, source);
  assertFileName(file, source);
  assertExportSurface(file, source);
  assertSubstitutionSafety(file, source);
  assertRolePurity(file, source);
  assertLayerPurity(file, source);
}

function assertServerRootEntryPoint(file) {
  if (
    /^starters\/voip-rtc\/server\/[^/]+\.ts$/.test(file) &&
    !permittedStarterServerRootFiles.has(file)
  ) {
    add(
      file,
      "soa-server-root-entrypoint-only",
      "server root may only expose the entrypoint; move responsibilities into app/http/voice/adapters/runtime",
    );
  }
}

function assertFileName(file, source) {
  const base = file.split("/").pop()?.replace(/\.(?:tsx?|mjs|js)$/, "") ?? "";
  if (vagueNames.has(base) && !isBarrelOnly(source)) {
    add(file, "solid-explicit-file-name", "rename vague files after the exact responsibility");
  }
}

function assertBarrelOnlyFile(file, source) {
  if (!barrelOnlyNamePattern.test(file)) return;
  if (permittedStarterServerRootFiles.has(file)) return;
  if (!isBarrelOnly(source)) {
    add(
      file,
      "solid-barrel-only",
      "files named index/utils/state/request/routing/protocol must only re-export contracts",
    );
  }
}

function assertSubstitutionSafety(file, source) {
  const inheritance = source.matchAll(
    /\bclass\s+[A-Za-z0-9_]+\s+extends\s+([A-Za-z0-9_.]+)/g,
  );
  for (const match of inheritance) {
    const baseClass = match[1].split(".").pop();
    if (!allowedInheritanceBases.has(baseClass)) {
      add(
        file,
        "lsp-no-concrete-inheritance",
        `inheritance from ${match[1]} must be replaced by a port/interface or composition`,
      );
    }
  }
}

function assertExportSurface(file, source) {
  if (barrelPattern.test(file) || typeModulePattern.test(file) || generatedTypeHubPattern.test(file)) {
    return;
  }

  const runtimeExports = countRuntimeExports(source);
  if (runtimeExports > maxRuntimeExports) {
    add(
      file,
      "srp-export-surface",
      `exports ${runtimeExports} runtime declarations; split responsibilities or hide helpers`,
    );
  }

  if (file.endsWith(".tsx") && countComponentExports(source) > 1) {
    add(file, "srp-one-component-per-file", "tsx files should export one component");
  }
}

function assertRolePurity(file, source) {
  const isUi = file.endsWith(".tsx") || importsFrom(source, "react");
  const isNodeRuntime = importsNodeRuntime(source) || importsFrom(source, "postgres") || importsFrom(source, "ws");
  if (isUi && isNodeRuntime) {
    add(file, "soa-ui-server-mix", "UI modules cannot own server/database/runtime responsibilities");
  }
}

function assertLayerPurity(file, source) {
  const imports = importSpecifiers(source);
  if (file.startsWith("starters/voip-rtc/src/domain/")) {
    rejectImports(file, imports, /\/(?:api|components|features|hooks)\//, "domain-pure");
    rejectImports(file, imports, /(?:^|\/)server\//, "domain-no-server");
    rejectPackage(file, imports, "react", "domain-no-react");
  }

  if (file.includes("/components/ui/")) {
    rejectImports(file, imports, /\/(?:api|domain|features|hooks)\//, "ui-primitive-leaf");
  }

  if (file.startsWith("src/sdk/")) {
    rejectImports(file, imports, /^src\/(?:server|client)\//, "sdk-foundation");
  }

  if (file.startsWith("starters/voip-rtc/server/builder/domain/")) {
    rejectImports(
      file,
      imports,
      /^starters\/voip-rtc\/server\/builder\/(?:adapters|composition|router|service|state|workflows|workflow-infra)\b/,
      "builder-domain-pure",
    );
  }
}

function countRuntimeExports(source) {
  const matches = source.matchAll(
    /^export\s+(?:async\s+)?(?:function|class|const|let|var|enum)\s+[A-Za-z0-9_]+/gm,
  );
  return Array.from(matches).length;
}

function isBarrelOnly(source) {
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*import[\s\S]*?;\s*/gm, "")
    .replace(/^\s*export[\s\S]*?;\s*/gm, "")
    .trim();
  return cleaned.length === 0;
}

function countComponentExports(source) {
  const matches = source.matchAll(
    /^export\s+(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/gm,
  );
  return Array.from(matches).length;
}

function importsNodeRuntime(source) {
  return /\bfrom\s+["']node:/.test(source) ||
    /\bfrom\s+["'](?:fs|path|crypto|net|http|https)["']/.test(source);
}

function importsFrom(source, packageName) {
  return new RegExp(`\\bfrom\\s+["']${escapeRegExp(packageName)}(?:/[^"']*)?["']`).test(source);
}

function importSpecifiers(source) {
  const importLike = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  return Array.from(source.matchAll(importLike), (match) => normalize(match[1]));
}

function rejectImports(file, imports, pattern, rule) {
  for (const specifier of imports) {
    const resolved = resolveSpecifier(file, specifier);
    if (pattern.test(resolved)) {
      add(file, rule, `forbidden import: ${specifier}`);
    }
  }
}

function rejectPackage(file, imports, packageName, rule) {
  if (imports.includes(packageName)) {
    add(file, rule, `forbidden package import: ${packageName}`);
  }
}

function resolveSpecifier(file, specifier) {
  if (!specifier.startsWith(".")) return specifier;
  const parts = file.split("/");
  parts.pop();
  for (const segment of specifier.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return normalize(parts.join("/").replace(/\.(?:js|mjs|cjs)$/, ".ts"));
}

function add(file, rule, message) {
  violations.push({ file, rule, message });
}

function scanFiles(cwd, directories) {
  const files = [];
  for (const directory of directories) {
    walk(join(cwd, directory), files);
  }
  return files;
}

function walk(path, files) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    const segment = path.split("/").pop();
    if (segment && ignoredSegments.has(segment)) return;
    for (const entry of readdirSync(path)) walk(join(path, entry), files);
    return;
  }
  if (extensions.has(extensionOf(path)) && !path.endsWith(".d.ts")) files.push(path);
}

function extensionOf(path) {
  const match = path.match(/(\.[^.]+)$/);
  return match?.[1] ?? "";
}

function normalize(value) {
  return value.replace(/\\/g, "/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
