import type { CompiledVoiceAgentSdk } from "../../../sdk/runtime.js";

export interface FastifyVoiceAdapterOptions {
  runtime: CompiledVoiceAgentSdk;
  routePrefix?: string;
}

export interface FastifyLike {
  register: (...args: unknown[]) => unknown;
}

export function createFastifyVoiceAdapter(options: FastifyVoiceAdapterOptions) {
  return async function fastifyVoiceAdapter(app: FastifyLike): Promise<void> {
    void app;
    void options;
    throw new Error(
      "Fastify voice adapter is intentionally not wired in the clean-core sprint. Add SDK ports before enabling this adapter.",
    );
  };
}
