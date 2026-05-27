export function resolveCatalogOption(
  label: "model" | "voice",
  value: string | undefined,
  allowedValues: string[],
  fallback: string,
): string {
  const selected = value ?? fallback;
  if (!allowedValues.includes(selected)) {
    throw new Error(`Unsupported ${label} "${selected}"`);
  }
  return selected;
}
