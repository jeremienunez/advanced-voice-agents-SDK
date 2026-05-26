import type {
  EmbeddingInput,
  EmbeddingPort,
  EmbeddingVector,
} from "@voiceagentsdk/core/sdk";

export class VoyageEmbeddingPort implements EmbeddingPort {
  constructor(
    private readonly config: {
      apiKey?: string;
      model: string;
      dimensions: number;
    },
  ) {}

  async embed(input: EmbeddingInput[]): Promise<EmbeddingVector[]> {
    if (!this.config.apiKey) {
      throw new Error("VOYAGE_API_KEY is required to compile knowledge");
    }
    if (input.length === 0) return [];

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        input: input.map((item) => item.text),
        output_dimension: this.config.dimensions,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage embeddings failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    return input.map((item, index) => ({
      id: item.id,
      values: payload.data?.[index]?.embedding ?? [],
      dimensions: this.config.dimensions,
      metadata: item.metadata,
    }));
  }
}
