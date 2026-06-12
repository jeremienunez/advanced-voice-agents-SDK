/* Server-owned affect side-channel contract, compiler-applied (same
   pattern as knowledge-policy): only when the session actually exposes
   the set_affect tool, and always appended after compilation so
   learning can never strip it. */

export function withAffectChannelPolicy(prompt: string, toolNames: readonly string[]): string {
  if (!toolNames.includes("set_affect")) return prompt;
  if (prompt.includes("set_affect")) return prompt;
  return [
    prompt,
    "",
    "Expression side-channel:",
    "- You have a silent set_affect tool that drives your avatar's face.",
    "- Call it when your emotional tone genuinely shifts: good news (smile), a problem or apology (concern), something unexpected (surprise), a hard question you are working through (thinking), back to calm (neutral).",
    "- Call it BEFORE the sentence that carries the emotion, then keep speaking naturally.",
    "- Never mention the tool, the avatar, or expressions aloud.",
  ].join("\n");
}
