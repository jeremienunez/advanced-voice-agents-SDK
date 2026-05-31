import { readFileSync } from "node:fs";

type JsonRecord = Record<string, unknown>;

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as JsonRecord;

const results = [
  scenarioPackageIsPublicAlpha(),
  scenarioPackageMetadataIsPublishable(),
  scenarioPackageFilesStayCoreOnly(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioPackageIsPublicAlpha(): string {
  assert(pkg.name === "@voiceagentsdk/core", "package name must stay public core scope");
  assert(pkg.private !== true, "package must not be private for npm alpha");
  assert(
    typeof pkg.version === "string" && pkg.version.includes("-alpha."),
    "package version must be an alpha prerelease",
  );
  assert(
    asRecord(pkg.publishConfig).access === "public",
    "scoped npm package must publish with public access",
  );
  return "package-is-public-alpha";
}

function scenarioPackageMetadataIsPublishable(): string {
  assert(pkg.license === "MIT", "package must declare a license");
  assert(
    readString(asRecord(pkg.repository), "url").startsWith("git+https://"),
    "package must declare repository url",
  );
  assert(readString(asRecord(pkg.bugs), "url").includes("/issues"), "package must declare bugs url");
  assert(readString(pkg, "homepage").endsWith("#readme"), "package must declare homepage");
  return "package-metadata-is-publishable";
}

function scenarioPackageFilesStayCoreOnly(): string {
  const files = asStringArray(pkg.files);
  assert(files.includes("dist"), "package must publish dist");
  assert(files.includes("README.md"), "package must publish README");
  assert(files.includes("LICENSE"), "package must publish license");
  assert(files.includes("RELEASE_ALPHA.md"), "package must publish alpha release procedure");
  assert(files.includes("APP_OWNED_INTEGRATION.md"), "package must publish integration docs");
  assert(!files.some((entry) => entry.startsWith("starters")), "package must not publish starter");
  assert(!files.some((entry) => entry.startsWith("docs/")), "package must not publish internal docs");
  assert(!files.some((entry) => entry.startsWith("examples")), "package must not publish examples");
  return "package-files-stay-core-only";
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? value as JsonRecord : {};
}

function readString(value: unknown, key: string): string {
  const item = asRecord(value)[key];
  return typeof item === "string" ? item : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
