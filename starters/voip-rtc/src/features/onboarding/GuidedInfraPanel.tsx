import { Button } from "../../components/ui/Button.js";
import type {
  InfraAction,
  InfraActionResult,
  OnboardingDependency,
} from "../../domain/onboarding.js";

export function GuidedInfraPanel({
  busy,
  dependencies,
  driver,
  infraResult,
  onRefresh,
  onProfileChange,
  onRun,
  profile,
  ready,
  target,
}: {
  busy: string | null;
  dependencies: OnboardingDependency[];
  driver: string;
  infraResult: InfraActionResult | null;
  onRefresh: () => void;
  onProfileChange: (profile: "dev" | "user") => void;
  onRun: (action: InfraAction) => void;
  profile: "dev" | "user" | "custom";
  ready: boolean;
  target: string;
}) {
  const devMode = driver === "dev-local" && target === "local";
  const notOkCount = dependencies
    .filter((item) => requiredDependencyIds(driver).includes(item.id))
    .filter((item) => item.status !== "ok").length;
  return (
    <section className="onboardingPanel">
      <div className="guideHeader">
        <div>
          <p className="eyebrow">Start here</p>
          <h2>{devMode ? "Local dev setup" : "Guided user setup"}</h2>
          <span>
            The server stays local by default. Dev mode never touches Docker or
            Kubernetes; user mode creates a local K3s sandbox when selected.
          </span>
        </div>
        <Button disabled={Boolean(busy)} onClick={onRefresh}>
          Refresh checks
        </Button>
      </div>

      <div className="infraModeSwitch" aria-label="Infrastructure mode">
        <button
          aria-pressed={profile === "dev"}
          className={profile === "dev" ? "active" : ""}
          disabled={Boolean(busy)}
          onClick={() => onProfileChange("dev")}
          type="button"
        >
          <span>Dev local</span>
          <small>127.0.0.1 · plan only</small>
        </button>
        <button
          aria-pressed={profile === "user"}
          className={profile === "user" ? "active" : ""}
          disabled={Boolean(busy)}
          onClick={() => onProfileChange("user")}
          type="button"
        >
          <span>Guided user</span>
          <small>local Docker K3s sandbox</small>
        </button>
      </div>

      <div className="guidedSteps">
        <GuideStep
          actionLabel="Preview plan"
          busy={busy === "plan"}
          detail={devMode
            ? "Generate local plan files without changing the machine."
            : "Preview the local K3s sandbox manifests before apply."}
          index="1"
          onClick={() => onRun("plan")}
          title="Preview what will happen"
        />
        <GuideStep
          actionLabel={devMode ? "Apply dev plan" : "Create user sandbox"}
          busy={busy === "apply"}
          disabled={!ready}
          detail={devMode
            ? "Record the local plan without Docker, kubectl, or K3s."
            : "Create or reuse the local Docker-backed K3s sandbox."}
          index="2"
          onClick={() => onRun("apply")}
          primary
          title={devMode ? "Stay in dev mode" : "Run guided local infra"}
        />
        <GuideStep
          actionLabel={devMode ? "Check dev status" : "Check sandbox"}
          busy={busy === "status"}
          detail={devMode
            ? "Confirm the latest local plan without calling Kubernetes."
            : "Verify the namespace, config and network policy."}
          index="3"
          onClick={() => onRun("status")}
          title={devMode ? "Confirm local mode" : "Confirm sandbox"}
        />
      </div>

      <details className="checkDrawer" open={!ready && !devMode}>
        <summary>
          <span>{devMode ? "Optional tooling" : "User mode prerequisites"}</span>
          <small>{notOkCount ? `${notOkCount} item to review` : "checks passed"}</small>
        </summary>
        <div className="dependencyList">
          {dependencies.map((item) => (
            <div className="dependencyRow" key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail || item.command}</span>
              </div>
              <div className="dependencyActions">
                <span className={`pill ${item.status}`}>{item.status}</span>
                {item.status !== "ok" && (
                  <a href={item.docsUrl} rel="noreferrer" target="_blank">Docs</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="advancedCleanup">
        <summary>Advanced cleanup</summary>
        <p>Stops and removes the optional K3s sandbox if you explicitly created one.</p>
        <Button disabled={Boolean(busy)} onClick={() => confirmDestroy(onRun)}>
          {busy === "destroy" ? "Cleaning up" : "Destroy local sandbox"}
        </Button>
      </details>

      {infraResult && (
        <pre className="infraOutput">{formatInfraResult(infraResult)}</pre>
      )}
    </section>
  );
}

function requiredDependencyIds(driver: string): string[] {
  if (driver === "k3s-docker") return ["docker-cli", "docker-daemon", "kubectl-cli"];
  if (driver === "kubectl") return ["kubectl-cli", "kubernetes-context"];
  return [];
}

function GuideStep({
  actionLabel,
  busy,
  detail,
  disabled,
  index,
  onClick,
  primary,
  title,
}: {
  actionLabel: string;
  busy: boolean;
  detail: string;
  disabled?: boolean;
  index: string;
  onClick: () => void;
  primary?: boolean;
  title: string;
}) {
  return (
    <div className={primary ? "guideStep primary" : "guideStep"}>
      <span className="guideIndex">{index}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <Button disabled={disabled || busy} onClick={onClick} variant={primary ? "primary" : "default"}>
        {busy ? "Running" : actionLabel}
      </Button>
    </div>
  );
}

function confirmDestroy(onRun: (action: InfraAction) => void) {
  if (window.confirm("Destroy the local onboarding K3s sandbox?")) {
    onRun("destroy");
  }
}

function formatInfraResult(result: InfraActionResult): string {
  return JSON.stringify(result.parsed ?? {
    status: result.ok ? "ok" : "error",
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }, null, 2);
}
