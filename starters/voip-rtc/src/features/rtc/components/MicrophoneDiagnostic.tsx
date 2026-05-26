import type { MicrophoneDiagnosticReport } from "../../../domain/microphone.js";

export function MicrophoneDiagnostic({
  report,
}: {
  report: MicrophoneDiagnosticReport;
}) {
  return (
    <div className="diagnosticBox">
      <strong>Microphone diagnostic</strong>
      <dl>
        <div>
          <dt>Secure context</dt>
          <dd>{report.secureContext ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>Media devices</dt>
          <dd>{report.mediaDevices ? "available" : "missing"}</dd>
        </div>
        <div>
          <dt>Permission</dt>
          <dd>{report.permission}</dd>
        </div>
        <div>
          <dt>Inputs</dt>
          <dd>{String(report.audioInputCount)}</dd>
        </div>
        <div>
          <dt>Open test</dt>
          <dd>{report.testStatus}</dd>
        </div>
      </dl>
      {report.audioInputs.length ? (
        <p>{report.audioInputs.join(", ")}</p>
      ) : (
        <p>No microphone label is visible yet.</p>
      )}
      {report.errorMessage ? (
        <p className="error">
          {report.errorName ? `${report.errorName}: ` : ""}
          {report.errorMessage}
        </p>
      ) : null}
    </div>
  );
}
