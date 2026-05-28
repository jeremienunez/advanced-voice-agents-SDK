import type { ReturnTypeOfUseRtcLab } from "./rtc-types.js";
import {
  AudioContractPanel,
  EventsPanel,
  SessionPanel,
  TranscriptPanel,
} from "./components/RtcPanels.js";

export function RtcDiagnosticsDrawer({
  isOpen,
  onClose,
  rtc,
}: {
  isOpen: boolean;
  onClose: () => void;
  rtc: ReturnTypeOfUseRtcLab;
}) {
  return (
    <>
      <div
        className={`rtcDrawerBackdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={`rtcDiagnosticsDrawer ${isOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Diagnostics panels">
        <header className="rtcDrawerHeader">
          <div className="rtcDrawerTitleBlock">
            <h2>Diagnostics & Realtime Logs</h2>
            <span className="rtcDrawerEventCount">{rtc.events.length} events recorded</span>
          </div>
          <button
            className="rtcDrawerCloseBtn"
            onClick={onClose}
            type="button"
            aria-label="Fermer les diagnostics"
          >
            &times;
          </button>
        </header>
        <div className="rtcDrawerScrollArea">
          <div className="rtcDiagnosticsGrid">
            <SessionPanel
              snapshot={rtc.snapshot}
              audioMode={rtc.audioMode}
              microphoneDiagnostic={rtc.microphoneDiagnostic}
              configError={rtc.configError}
              selectedProvider={rtc.selectedProvider}
            />
            <TranscriptPanel snapshot={rtc.snapshot} />
            <AudioContractPanel
              audioMode={rtc.audioMode}
              runtimeConfig={rtc.runtimeConfig}
              selectedProvider={rtc.selectedProvider}
            />
            <EventsPanel events={rtc.events} />
          </div>
        </div>
      </div>
    </>
  );
}
