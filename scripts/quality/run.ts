import { stepsForSuite, qualitySuites } from "./matrix.js";

type SuiteName = keyof typeof qualitySuites;

const suiteName = (process.argv[2] ?? "solid") as SuiteName;

if (!isSuiteName(suiteName)) {
  console.error(`Unknown quality suite: ${suiteName}`);
  console.error(`Available suites: ${Object.keys(qualitySuites).join(", ")}`);
  process.exit(1);
}

const steps = stepsForSuite(suiteName);
const startedAt = performance.now();

console.log(`[quality] running ${suiteName} (${steps.length} commands)`);

for (const [index, step] of steps.entries()) {
  const label = `${index + 1}/${steps.length}`;
  console.log(`[quality:${step.group}] ${label} pnpm ${step.command}`);
  const commandStartedAt = performance.now();
  const subprocess = Bun.spawn(["pnpm", step.command], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await subprocess.exited;
  const elapsedMs = Math.round(performance.now() - commandStartedAt);
  if (exitCode !== 0) {
    console.error(
      `[quality:${step.group}] failed after ${elapsedMs}ms: pnpm ${step.command}`,
    );
    process.exit(exitCode);
  }
  console.log(`[quality:${step.group}] passed in ${elapsedMs}ms`);
}

const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
console.log(`[quality] ${suiteName} passed in ${elapsedSeconds}s`);

function isSuiteName(value: string): value is SuiteName {
  return Object.prototype.hasOwnProperty.call(qualitySuites, value);
}
