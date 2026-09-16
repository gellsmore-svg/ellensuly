import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Action, NodeMetrics } from "../../api/types";

export interface ActionData {
  action: Action;
  metrics?: NodeMetrics;
  dimmed?: boolean;
  chosen?: boolean;
}

export function ActionNode({ data, selected }: NodeProps) {
  const { action, dimmed, chosen } = data as unknown as ActionData;
  return (
    <div
      className={`rf-node action-node ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""}`}
      tabIndex={0}
      role="treeitem"
      aria-label={`Action: ${action.title}. ${action.treatment_category}, ${action.decision_status.replaceAll("_", " ")}.`}
      style={chosen ? { boxShadow: "0 0 0 3px var(--focus)" } : undefined}
    >
      <Handle type="target" position={Position.Left} />
      <div className="kind">Action · {action.treatment_category}</div>
      <div className="node-title">{action.title}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
