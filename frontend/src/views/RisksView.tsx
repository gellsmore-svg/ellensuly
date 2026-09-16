import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Risk } from "../api/types";

export function RisksView() {
  const [risks, setRisks] = useState<Risk[]>([]);
  useEffect(() => {
    api.risks().then(setRisks);
  }, []);
  return (
    <div className="page">
      <div className="kicker">Canonical</div>
      <h1>Risks</h1>
      <p className="help">
        A Risk is the underlying concept. Probability lives on each Exposure, not here.
      </p>
      <ul>
        {risks.map((r) => (
          <li key={r.id}>
            <Link to={`/risks/${r.id}`}>{r.title}</Link>
            <span className="help"> {r.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RiskDetailView() {
  const { riskId } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.riskOccurrences>> | null>(null);
  useEffect(() => {
    if (riskId) api.riskOccurrences(riskId).then(setData);
  }, [riskId]);
  if (!data) return <div className="page">Loading…</div>;
  return (
    <div className="page">
      <div className="kicker">Canonical risk</div>
      <h1>{data.risk.title}</h1>
      <p>{data.risk.description}</p>
      <p className="help">Appears as:</p>
      <ul>
        {data.occurrences.map((o) => (
          <li key={o.exposure.id}>
            <Link to={`/g/${o.exposure.graph_id}`}>{o.graph?.title ?? o.exposure.graph_id}</Link>
            {" — "}
            {o.exposure.contextual_description || "Exposure"} (L{o.exposure.likelihood ?? "–"} × I
            {o.exposure.impact.overall ?? "–"}, confidence {o.exposure.confidence ?? "–"})
          </li>
        ))}
      </ul>
    </div>
  );
}
