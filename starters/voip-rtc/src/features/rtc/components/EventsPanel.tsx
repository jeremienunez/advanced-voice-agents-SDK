import { Panel } from "../../../components/ui/Panel.js";
import type { EventLogEntry } from "../../../domain/runtime/events.js";

export function EventsPanel({ events }: { events: EventLogEntry[] }) {
  return (
    <Panel title="Journal d'Événements SDK" className="span2">
      <div className="events" style={{ height: "200px", maxHeight: "200px", overflowY: "auto", display: "grid", gap: "12px" }}>
        {events.length === 0 ? (
          <p className="muted" style={{ padding: "24px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", margin: 0 }}>Aucun événement enregistré.</p>
        ) : (
          events.map((event) => (
            <article key={event.id} className="eventRow">
              <time style={{ fontSize: "11px", color: "var(--slate-500)", fontFamily: "monospace" }}>{event.timestamp}</time>
              <strong style={{ fontSize: "12px", color: "var(--google-blue)" }}>{event.label}</strong>
              <span style={{ fontSize: "11px", color: "var(--slate-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.detail}</span>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}
