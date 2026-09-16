import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../state/store";

export function Composer({
  graphId,
  exposureId,
  actionId,
}: {
  graphId: string;
  exposureId?: string;
  actionId?: string;
}) {
  const loadGraph = useApp((s) => s.loadGraph);
  const taxonomy = useApp((s) => s.taxonomy);
  const bundle = useApp((s) => s.bundle);
  const [open, setOpen] = useState(false);

  if (!taxonomy || !bundle) return null;

  if (exposureId) {
    return (
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Add a response</summary>
        <form
          className="field"
          onSubmit={async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await api.createAction(graphId, {
              title: fd.get("title"),
              treatment_category: fd.get("treatment_category"),
              description: fd.get("description"),
              in_response_to: exposureId,
            });
            e.currentTarget.reset();
            await loadGraph(graphId);
          }}
        >
          <label>
            Action
            <input name="title" required placeholder="e.g. Add a second supplier" />
          </label>
          <label>
            Treatment
            <select name="treatment_category" defaultValue="mitigate">
              {taxonomy.treatment_categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea name="description" rows={2} />
          </label>
          <button className="btn primary" type="submit">
            Add action
          </button>
        </form>
      </details>
    );
  }

  if (actionId) {
    return (
      <details>
        <summary>Add a resulting risk</summary>
        <p className="help">
          Create a new risk, reuse a canonical risk as a new exposure, or converge on an existing
          exposure in this graph.
        </p>
        <ResultingForm graphId={graphId} actionId={actionId} />
      </details>
    );
  }

  return (
    <details>
      <summary>Add a focal risk</summary>
      <form
        className="field"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          await api.createExposure(graphId, {
            new_risk: { title: fd.get("title"), description: fd.get("description") },
            contextual_description: fd.get("context"),
            likelihood: Number(fd.get("likelihood") || 3),
            impact: { overall: Number(fd.get("impact") || 3) },
            as_focal: true,
          });
          e.currentTarget.reset();
          await loadGraph(graphId);
        }}
      >
        <label>
          Risk
          <input name="title" required placeholder="What can go wrong?" />
        </label>
        <label>
          In this context
          <input name="context" placeholder="How it shows up in this decision" />
        </label>
        <div className="row">
          <label>
            Likelihood
            <input name="likelihood" type="number" min={1} max={5} defaultValue={3} />
          </label>
          <label>
            Impact
            <input name="impact" type="number" min={1} max={5} defaultValue={3} />
          </label>
        </div>
        <button className="btn primary" type="submit">
          Add risk
        </button>
      </form>
    </details>
  );
}

function ResultingForm({ graphId, actionId }: { graphId: string; actionId: string }) {
  const loadGraph = useApp((s) => s.loadGraph);
  const taxonomy = useApp((s) => s.taxonomy)!;
  const bundle = useApp((s) => s.bundle)!;
  const [mode, setMode] = useState<"new_risk" | "existing_risk_new_exposure" | "existing_exposure">(
    "new_risk",
  );
  return (
    <form
      className="field"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await api.resultingRisk(graphId, {
          action_id: actionId,
          mode,
          semantics: fd.get("semantics"),
          custom_label: fd.get("custom_label"),
          new_risk: mode === "new_risk" ? { title: fd.get("title") } : undefined,
          existing_risk_id: mode === "existing_risk_new_exposure" ? fd.get("existing_risk_id") : undefined,
          existing_exposure_id: mode === "existing_exposure" ? fd.get("existing_exposure_id") : undefined,
          contextual_description: fd.get("context"),
          exposure: {
            likelihood: Number(fd.get("likelihood") || 3),
            impact: { overall: Number(fd.get("impact") || 3) },
            confidence: Number(fd.get("confidence") || 3),
          },
        });
        await loadGraph(graphId);
      }}
    >
      <label>
        This action
        <select name="semantics" defaultValue="creates">
          {Object.entries(taxonomy.relationship_semantics)
            .filter(([, m]) => m.from_kinds.includes("action"))
            .map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
        </select>
      </label>
      <label>
        How to add the risk
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="new_risk">Create new Risk</option>
          <option value="existing_risk_new_exposure">Reuse canonical Risk as a new Exposure</option>
          <option value="existing_exposure">Converge on an existing Exposure</option>
        </select>
      </label>
      {mode === "new_risk" && (
        <label>
          New risk
          <input name="title" required placeholder="Resulting risk" />
        </label>
      )}
      {mode === "existing_risk_new_exposure" && (
        <label>
          Canonical risk
          <select name="existing_risk_id" required>
            {bundle.risks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {mode === "existing_exposure" && (
        <label>
          Existing exposure
          <select name="existing_exposure_id" required>
            {bundle.exposures.map((e) => (
              <option key={e.id} value={e.id}>
                {e.risk_title}
              </option>
            ))}
          </select>
        </label>
      )}
      {mode !== "existing_exposure" && (
        <>
          <label>
            Context in this branch
            <input name="context" />
          </label>
          <div className="row">
            <label>
              L
              <input name="likelihood" type="number" min={1} max={5} defaultValue={3} />
            </label>
            <label>
              I
              <input name="impact" type="number" min={1} max={5} defaultValue={3} />
            </label>
            <label>
              C
              <input name="confidence" type="number" min={1} max={5} defaultValue={3} />
            </label>
          </div>
        </>
      )}
      <button className="btn primary" type="submit">
        Add resulting risk
      </button>
    </form>
  );
}
