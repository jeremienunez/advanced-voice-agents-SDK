import { createBuilderServiceCompositionFromEnv } from "./composition.js";
import { createBuilderRouter } from "./router.js";
import { createBuilderWorkflows } from "./workflows.js";
import { activeCompiledDraft } from "./state/active-draft.js";
import { getDraft } from "./state/draft-store.js";
import { builderSessionPayload } from "./state/session-payload.js";
import type {
  BuilderRouteResult,
  BuilderServiceOptions,
} from "./types.js";

export function createBuilderService(options: BuilderServiceOptions) {
  const composition =
    options.composition ?? createBuilderServiceCompositionFromEnv();
  const workflows = createBuilderWorkflows(composition.workflows);
  const router = createBuilderRouter({
    config: composition.config,
    corsHeaders: options.corsHeaders,
    workflows,
  });

  return {
    getCompiledArtifact(draftId: string | undefined) {
      if (draftId) return getDraft(draftId)?.compiled;
      return activeCompiledDraft()?.compiled;
    },

    getCompiledDraft(draftId: string | undefined) {
      const draft = draftId ? getDraft(draftId) : activeCompiledDraft();
      return draft?.compiled ? draft : undefined;
    },

    getActiveSession() {
      return builderSessionPayload();
    },

    handle(request: Request, url: URL): Promise<BuilderRouteResult> {
      return router.handle(request, url);
    },
  };
}

export function createBuilderServiceFromEnv(options: BuilderServiceOptions) {
  return createBuilderService({
    ...options,
    composition: createBuilderServiceCompositionFromEnv(),
  });
}
