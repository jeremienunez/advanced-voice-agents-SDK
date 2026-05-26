export function buildFunctionResultItem(
  callId: string,
  result: unknown,
): Record<string, unknown> {
  return {
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(result),
    },
  };
}

export function buildSystemMessageItem(
  itemId: string,
  content: string,
): Record<string, unknown> {
  return {
    item: {
      id: itemId,
      type: "message",
      role: "system",
      content: [{ type: "input_text", text: content }],
    },
  };
}
