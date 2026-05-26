import { useEffect } from "react";
import { fetchBuilderSession } from "../api/builderApi.js";
import type { CompiledAgentSummary } from "../domain/builder.js";

export function useBuilderSessionRestore({
  apiBase,
  onCompiled,
}: {
  apiBase: string;
  onCompiled: (artifact: CompiledAgentSummary) => void;
}) {
  useEffect(() => {
    const controller = new AbortController();

    async function restoreActiveBuilderSession(): Promise<void> {
      try {
        const session = await fetchBuilderSession(apiBase, controller.signal);
        if (session?.artifact) onCompiled(session.artifact);
      } catch {
        // RTC still works with the starter default prompt if no builder session exists.
      }
    }

    void restoreActiveBuilderSession();
    return () => controller.abort();
  }, [apiBase, onCompiled]);
}
