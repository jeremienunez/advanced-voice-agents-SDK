export async function fetchDeepSeekText(input: {
  apiKey?: string;
  baseUrl: string;
  defaultModel: string;
  maxTokens: number;
  model?: string;
  system: string;
  user: string;
}): Promise<string> {
  const response = await fetch(`${input.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model || input.defaultModel,
      temperature: 0.2,
      max_tokens: input.maxTokens,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `DeepSeek request failed: ${response.status} ${await response.text()}`,
    );
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content?.trim() ||
    "No text returned.";
}
