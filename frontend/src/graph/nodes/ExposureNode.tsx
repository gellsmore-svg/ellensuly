import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeMetrics, RiskExposure } from "../../api/types";
import { exposureStyle, urgencyRings } from "../lenses";
import type { LensId } from "../../api/types";

export interface ExposureData {
  exposure: RiskExposure;
  metrics?: NodeMetrics;
  lens: LensId;
  dimmed?: boolean;
}

export function ExposureNode({ data, selected }: NodeProps) {
  const { exposure, metrics, lens, dimmed } = data as unknown as ExposureData;
  const { style, classes } = exposureStyle(exposure, lens, metrics);
  const rings = urgencyRings(exposure);
  const showRings = lens === "urgency" || lens === "decision";
  return (
    <div
      className={`rf-node exposure-node ${classes.join(" ")} ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""}`}
      style={style}
      tabIndex={0}
      role="treeitem"
      aria-label={`Risk exposure: ${exposure.risk_title ?? "Untitled"}. Likelihood ${exposure.likelihood ?? "unassessed"}, impact ${exposure.impact.overall ?? "unassessed"}.`}
    >
      {showRings && (
        <>
          <span
            className="rings"
            style={{
              borderColor: `color-mix(in srgb, var(--accent-2) ${Math.round(rings.outer * 100)}%, transparent)`,
              borderWidth: 2 + Math.round(rings.outer * 3),
            }}
            aria-hidden
          />
          <span
            className="rings inner"
            style={{
              borderColor: `color-mix(in srgb, var(--accent) ${Math.round(rings.inner * 100)}%, transparent)`,
              borderWidth: 2 + Math.round(rings.inner * 2),
            }}
            aria-hidden
          />
        </>
      )}
      <Handle type="target" position={Position.Left} />
      <div className="kicker" style={{ marginBottom: 2 }}>
        Risk exposure
      </div>
      <div className="node-title">{exposure.risk_title ?? "Untitled risk"}</div>
      <div className="node-meta">
        <span className="badge hash" title="Likelihood × impact. Prioritisation lens only.">
          L{exposure.likelihood ?? "–"} × I{exposure.impact.overall ?? "–"}
          {exposure.exposure.score != null ? ` = ${exposure.exposure.score}` : ""}
        </span>
        {metrics?.is_convergence && (
          <span className="badge" title="Reached through more than one action path.">
            converges
          </span>
        )}
        {metrics?.cycle_member && (
          <span className="badge" title="This node sits on a directed cycle.">
            cycle
          </span>
        )}
        {metrics?.structurally_important && lens === "connectivity" && (
          <span className="badge" title="Lies on many paths through the graph.">
            central
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
