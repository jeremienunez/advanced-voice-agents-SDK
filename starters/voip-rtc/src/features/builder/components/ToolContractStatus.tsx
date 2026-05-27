import type {
  ToolBuildContract,
  ToolValidationReport,
} from "../../../domain/builder.js";

export function ToolContractStatus({
  contract,
  validation,
}: {
  contract?: ToolBuildContract;
  validation?: ToolValidationReport;
}) {
  if (!contract) return null;
  const issues = validation?.issues.filter((issue) =>
    issue.toolName === contract.name,
  ) ?? [];
  return (
    <small className={`toolContract toolContract-${contract.readiness}`}>
      <span>{contract.runtimeBinding.handlerRef}</span>
      <span>{contract.sideEffect}</span>
      {contract.confirmation.required ? <span>confirm</span> : null}
      {issues.length > 0 ? <span>{issues[0]?.message}</span> : null}
    </small>
  );
}
