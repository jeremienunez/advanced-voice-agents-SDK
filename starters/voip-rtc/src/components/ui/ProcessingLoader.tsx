import type { BusyState } from "../../domain/builderProgress.js";
import { AnimatedGradientBackground } from "./AnimatedGradientBackground.js";

export function ProcessingLoader({ state }: { state: BusyState }) {
  return (
    <section className="workLoader" role="status" aria-live="polite">
      <AnimatedGradientBackground
        breathing
        animationSpeed={0.04}
        breathingRange={7}
        containerClassName="loaderGradient"
        startingGap={118}
        topOffset={18}
      />
      <div className="loaderStatus" aria-hidden="true">
        <span>Processing</span>
        <strong>{state.title}</strong>
        <div className="loaderSteps">
          {state.steps.map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
      </div>
      <span className="loaderScreenReader">
        {state.title}. {state.detail}
      </span>
    </section>
  );
}
