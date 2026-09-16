import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeKey } from "../api/types";
import { useApp } from "../state/store";
import { ActionNode } from "./nodes/ActionNode";
import { ExposureNode } from "./nodes/ExposureNode";
import { layoutGraph } from "./layout";
import { Legend } from "../components/Legend";
import { LENSES } from "./lenses";
import { download, graphToSvg } from "./exportSvg";
import { toPng } from "html-to-image";

const nodeTypes = { exposure: ExposureNode, action: ActionNode };

export function GraphCanvas({ presentation = false }: { presentation?: boolean }) {
  const bundle = useApp((s) => s.bundle);
  const lens = useApp((s) => s.lens);
  const setLens = useApp((s) => s.setLens);
  const selectedId = useApp((s) => s.selectedId);
  const select = useApp((s) => s.select);
  const highlighted = useApp((s) => s.highlighted);
  const decisionActionId = useApp((s) => s.decisionActionId);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flowEl, setFlowEl] = useState<HTMLElement | null>(null);

  const built = useMemo(() => {
    if (!bundle) return { nodes: [] as Node[], edges: [] as Edge[] };
    const dim = highlighted.size > 0;
    const n: Node[] = [
      ...bundle.exposures.map((e) => {
        const id = nodeKey("exposure", e.id);
        return {
          id,
          type: "exposure",
          position: bundle.graph.view_state.positions[id] ?? { x: 0, y: 0 },
          data: {
            exposure: e,
            metrics: bundle.analysis.metrics[id],
            lens,
            dimmed: dim && !highlighted.has(id),
          },
          selected: selectedId === id,
        };
      }),
      ...bundle.actions.map((a) => {
        const id = nodeKey("action", a.id);
        return {
          id,
          type: "action",
          position: bundle.graph.view_state.positions[id] ?? { x: 0, y: 0 },
          data: {
            action: a,
            metrics: bundle.analysis.metrics[id],
            dimmed: dim && !highlighted.has(id),
            chosen: decisionActionId === a.id,
          },
          selected: selectedId === id,
        };
      }),
    ];
    const e: Edge[] = bundle.relationships.map((r) => {
      const source = nodeKey(r.source_kind, r.source_id);
      const target = nodeKey(r.target_kind, r.target_id);
      const faded = dim && !(highlighted.has(source) && highlighted.has(target));
      return {
        id: r.id,
        source,
        target,
        label: r.custom_label || r.semantics.replaceAll("_", " "),
        markerEnd: r.directed ? { type: MarkerType.ArrowClosed, width: 16, height: 16 } : undefined,
        style: { stroke: faded ? "var(--line)" : "var(--action-stroke)", opacity: faded ? 0.25 : 1 },
        labelStyle: { fill: "var(--text-muted)", fontSize: 10 },
      };
    });
    return { nodes: n, edges: e };
  }, [bundle, lens, selectedId, highlighted, decisionActionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = bundle?.graph.view_state.positions ?? {};
      const hasStored = Object.keys(stored).length > 0;
      const laid = hasStored ? built.nodes : await layoutGraph(built.nodes, built.edges);
      if (!cancelled) {
        setNodes(laid);
        setEdges(built.edges);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [built, bundle, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      select(node.id);
    },
    [select],
  );

  if (!bundle) return null;

  return (
    <div className="canvas-wrap" ref={setFlowEl} role="application" aria-label="Risk decision graph">
      {!presentation && (
        <div className="toolbar">
          <div className="lenses" role="tablist" aria-label="Visual lenses">
            {LENSES.map((l) => (
              <button
                key={l.id}
                className={`chip ${lens === l.id ? "active" : ""}`}
                onClick={() => setLens(l.id)}
                role="tab"
                aria-selected={lens === l.id}
                title={`${l.title} (key ${l.key})`}
              >
                {l.title}
              </button>
            ))}
          </div>
          <div className="row">
            <button
              className="btn"
              onClick={async () => {
                const laid = await layoutGraph(nodes, edges);
                setNodes(laid);
              }}
            >
              Relayout
            </button>
            <button
              className="btn"
              onClick={() => {
                const pos: Record<string, { x: number; y: number }> = {};
                for (const n of nodes) pos[n.id] = n.position;
                download(`${bundle.graph.title}.svg`, graphToSvg(bundle, pos), "image/svg+xml");
              }}
            >
              Export SVG
            </button>
            <button
              className="btn"
              onClick={async () => {
                if (!flowEl) return;
                const url = await toPng(flowEl, { cacheBust: true, backgroundColor: "#12151a" });
                const a = document.createElement("a");
                a.href = url;
                a.download = `${bundle.graph.title}.png`;
                a.click();
              }}
            >
              Export PNG
            </button>
          </div>
        </div>
      )}
      {presentation && (
        <div className="toolbar">
          <div className="lenses">
            {LENSES.map((l) => (
              <button key={l.id} className={`chip ${lens === l.id ? "active" : ""}`} onClick={() => setLens(l.id)}>
                {l.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => select(null)}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        aria-label="Directed risk-decision graph"
      >
        <Background gap={24} color="var(--line)" />
        <Controls showInteractive={!presentation} />
        {!presentation && (
          <MiniMap
            nodeColor={(n) => (n.type === "action" ? "#8aa0b0" : "#c4a35a")}
            maskColor="rgba(0,0,0,0.4)"
          />
        )}
      </ReactFlow>
      <Legend presentation={presentation} />
    </div>
  );
}
