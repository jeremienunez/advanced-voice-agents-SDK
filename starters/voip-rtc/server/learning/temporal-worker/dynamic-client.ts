import type {
  TemporalWorkerClientPort,
  TemporalWorkerStartInput,
  TemporalWorkerStartResult,
} from "./types.js";

export class DynamicTemporalWorkerClient implements TemporalWorkerClientPort {
  async startLearningWorkflow(
    input: TemporalWorkerStartInput,
  ): Promise<TemporalWorkerStartResult> {
    const temporal = await loadTemporalClient();
    const connection = await temporal.Connection.connect({ address: input.address });
    const client = new temporal.Client({
      connection,
      namespace: input.namespace,
    });
    const handle = await client.workflow.start(input.workflowType, {
      args: [input.input],
      taskQueue: input.taskQueue,
      workflowId: input.workflowId,
    });
    return {
      workflowId: handle.workflowId ?? input.workflowId,
      runId: handle.firstExecutionRunId,
    };
  }
}

async function loadTemporalClient(): Promise<{
  Client: new (options: Record<string, unknown>) => {
    workflow: {
      start(
        workflowType: string,
        options: Record<string, unknown>,
      ): Promise<{
        workflowId?: string;
        firstExecutionRunId?: string;
      }>;
    };
  };
  Connection: {
    connect(options: { address: string }): Promise<unknown>;
  };
}> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;
  const temporal = await dynamicImport("@temporalio/client");
  return temporal as Awaited<ReturnType<typeof loadTemporalClient>>;
}
