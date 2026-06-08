export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

export function assertThrows(
  action: () => unknown,
  expectedMessage: string,
): void {
  try {
    action();
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes(expectedMessage),
      `expected error message to include "${expectedMessage}"`,
    );
    return;
  }
  fail(`expected action to throw "${expectedMessage}"`);
}

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
