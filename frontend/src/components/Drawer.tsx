import { useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { parseNodeKey } from "../api/types";
import { useApp } from "../state/store";
import { Radar } from "./Radar";
import { Teach } from "./HelpTip";
import { ComparePanel } from "./ComparePanel";
import { Composer } from "./Composer";

export function Drawer() {
  const bundle = useApp((s) => s.bundle);
  const selectedId = useApp((s) => s.selectedId);
  if (!bundle) return <aside className="drawer" />;
  if (!selectedId) {
    return (
      <aside className="drawer">
        <div className="kicker">Decision graph</div>
        <h2>{bundle.graph.title}</h2>
        <p className="help">{bundle.graph.objective || bundle.graph.description}</p>
        <Teach id="decision-graph" />
        <Composer graphId={bundle.graph.id} />
        <h3 className="kicker" style={{ marginTop: 24 }}>
          Structural notes
        </h3>
        {bundle.analysis.insights.slice(0, 6).map((ins, i) => (
          <article className="insight" key={`${ins.code}-${i}`}>
            <strong>{ins.title}</strong>
            <p>{ins.statement}</p>
            <p className="help">{ins.explanation}</p>
          </article>
        ))}
      </aside>
    );
  }
  return <SelectedDrawer selectedId={selectedId} />;
}

function SelectedDrawer({ selectedId }: { selectedId: string }) {
  const bundle = useApp((s) => s.bundle)!;
  const refreshCompare = useApp((s) => s.refreshCompare);
  const compare = useApp((s) => s.compare);
  const setDecisionAction = useApp((s) => s.setDecisionAction);
  const setHighlighted = useApp((s) => s.setHighlighted);
  const { kind, id } = parseNodeKey(selectedId);
  const exposure = kind === "exposure" ? bundle.exposures.find((e) => e.id === id) : undefined;
  const action = kind === "action" ? bundle.actions.find((a) => a.id === id) : undefined;
  const metrics = bundle.analysis.metrics[selectedId];
  const rels = bundle.relationships.filter(
    (r) => (r.source_kind === kind && r.source_id === id) || (r.target_kind === kind && r.target_id === id),
  );

  useEffect(() => {
    if (exposure) refreshCompare(exposure.id).catch(() => undefined);
  }, [exposure?.id, refreshCompare]);

  const sameRisk =
    exposure && bundle.analysis.repeated_canonical_risks.find((o) => o.risk_id === exposure.risk_id);

  return (
    <aside className="drawer" aria-live="polite">
      {exposure && (
        <>
          <div className="kicker">Risk exposure</div>
          <h2>{exposure.risk_title}</h2>
          <Teach id="exposure" />
          <p>{exposure.contextual_description}</p>
          <p className="help">
            Canonical risk:{" "}
            <Link to={`/risks/${exposure.risk_id}`}>{exposure.risk_title}</Link>
          </p>
          <AssessmentBlock exposureId={exposure.id} />
          <Radar exposure={exposure} />
          {exposure.assumptions && (
            <p>
              <strong>Assumptions.</strong> {exposure.assumptions}
            </p>
          )}
          {exposure.evidence && (
            <p>
              <strong>Evidence.</strong> {exposure.evidence}
            </p>
          )}
          {metrics && <MetricsBlock metrics={metrics} />}
          {sameRisk && (
            <article className="insight">
              <strong>Shared underlying risk</strong>
              <p>
                This canonical risk appears in {sameRisk.count} contexts in this graph, with different
                assessments.
              </p>
            </article>
          )}
          <Relations rels={rels} current={selectedId} />
          {compare && (
            <ComparePanel
              landscapes={compare}
              onChoose={(actionId) => {
                setDecisionAction(actionId);
                api.decisionPath(bundle.graph.id, actionId).then((res) => setHighlighted(res.node_ids));
              }}
            />
          )}
          <Composer graphId={bundle.graph.id} exposureId={exposure.id} />
        </>
      )}
      {action && (
        <>
          <div className="kicker">Action</div>
          <h2>{action.title}</h2>
          <Teach id="action" />
          <p>{action.description}</p>
          <p className="help">
            {action.treatment_category} · {action.decision_status.replaceAll("_", " ")}
          </p>
          {action.rationale && (
            <p>
              <strong>Rationale.</strong> {action.rationale}
            </p>
          )}
          <Teach id="counter-risk" />
          {metrics && <MetricsBlock metrics={metrics} />}
          <Relations rels={rels} current={selectedId} />
          <button
            className="btn primary"
            onClick={() => {
              setDecisionAction(action.id);
              api.decisionPath(bundle.graph.id, action.id).then((res) => setHighlighted(res.node_ids));
            }}
          >
            Show this decision landscape
          </button>
          <Composer graphId={bundle.graph.id} actionId={action.id} />
        </>
      )}
    </aside>
  );
}

function AssessmentBlock({ exposureId }: { exposureId: string }) {
  const exposure = useApp((s) => s.bundle?.exposures.find((e) => e.id === exposureId));
  const config = useApp((s) => s.config);
  const loadGraph = useApp((s) => s.loadGraph);
  if (!exposure || !config) return null;
  const current = exposure;
  const cfg = config;

  async function patch(field: string, value: number) {
    await api.patchExposure(current.id, { [field]: value });
    await loadGraph(current.graph_id);
  }

  return (
    <div>
      <ScaleSelect
        label="Likelihood"
        helpId="likelihood"
        value={current.likelihood}
        scale={cfg.likelihood}
        onChange={(v) => patch("likelihood", v)}
      />
      <ScaleSelect
        label="Impact"
        helpId="impact"
        value={current.impact.overall}
        scale={cfg.impact}
        onChange={async (v) => {
          await api.patchExposure(current.id, { impact: { ...current.impact, overall: v, overall_source: "user" } });
          await loadGraph(current.graph_id);
        }}
      />
      <p className="help">
        Exposure score {current.exposure.score ?? "—"} ({current.exposure.band ?? "unassessed"}).{" "}
        {current.exposure.caveat}
      </p>
      <ScaleSelect
        label="Proximity"
        helpId="proximity"
        value={current.proximity}
        scale={cfg.proximity}
        onChange={(v) => patch("proximity", v)}
      />
      <ScaleSelect
        label="Velocity"
        helpId="velocity"
        value={current.velocity}
        scale={cfg.velocity}
        onChange={(v) => patch("velocity", v)}
      />
      <ScaleSelect
        label="Confidence"
        helpId="confidence"
        value={current.confidence}
        scale={cfg.confidence}
        onChange={(v) => patch("confidence", v)}
      />
      {current.uncertainty != null && (
        <p className="help">
          Uncertainty {current.uncertainty} (6 − confidence). Farther from centre on the profile means more
          concern.
        </p>
      )}
    </div>
  );
}

function ScaleSelect({
  label,
  helpId,
  value,
  scale,
  onChange,
}: {
  label: string;
  helpId: string;
  value: number | null;
  scale: { levels: Array<{ value: number; name: string; definition: string }>; teach: string };
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={helpId}>
        {label}
        <span className="help"> — {scale.teach}</span>
      </label>
      <select id={helpId} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="">Unassessed</option>
        {scale.levels.map((l) => (
          <option key={l.value} value={l.value} title={l.definition}>
            {l.value} · {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetricsBlock({ metrics }: { metrics: import("../api/types").NodeMetrics }) {
  return (
    <section>
      <h3 className="kicker">Structure</h3>
      <Teach id="connectivity" />
      <ul className="help">
        <li>Incoming {metrics.in_degree} · outgoing {metrics.out_degree}</li>
        <li>Downstream exposures: {metrics.downstream_risk_count}</li>
        <li>Upstream exposures: {metrics.upstream_risk_count}</li>
        {metrics.is_convergence && <li>Convergence: {metrics.incoming_action_paths} action paths meet here.</li>}
        {metrics.cycle_member && <li>Cycle member.</li>}
        {metrics.structurally_important && (
          <li>
            Structurally important (betweenness {metrics.betweenness_centrality.toFixed(3)}). This is not
            severity.
          </li>
        )}
      </ul>
    </section>
  );
}

function Relations({
  rels,
  current,
}: {
  rels: import("../api/types").Relationship[];
  current: string;
}) {
  const select = useApp((s) => s.select);
  const bundle = useApp((s) => s.bundle);
  if (!bundle) return null;
  const graph = bundle;
  function label(kind: string, id: string) {
    if (kind === "exposure") return graph.exposures.find((e) => e.id === id)?.risk_title ?? id;
    return graph.actions.find((a) => a.id === id)?.title ?? id;
  }
  return (
    <section>
      <h3 className="kicker">Relationships</h3>
      <ul>
        {rels.map((r) => {
          const outbound = `${r.source_kind}:${r.source_id}` === current;
          const otherKind = outbound ? r.target_kind : r.source_kind;
          const otherId = outbound ? r.target_id : r.source_id;
          const word = r.custom_label || r.semantics.replaceAll("_", " ");
          return (
            <li key={r.id}>
              <button className="chip" onClick={() => select(`${otherKind}:${otherId}`)}>
                {outbound ? `${word} → ${label(otherKind, otherId)}` : `${label(otherKind, otherId)} → ${word}`}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
