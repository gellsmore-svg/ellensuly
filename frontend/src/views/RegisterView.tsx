import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { RegisterRow } from "../api/types";
import { useApp } from "../state/store";

export function RegisterView() {
  const { graphId } = useParams();
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof RegisterRow | "score" | "likelihood" | "impact">("score");
  const select = useApp((s) => s.select);
  const loadGraph = useApp((s) => s.loadGraph);

  useEffect(() => {
    api.register(graphId).then(setRows);
    if (graphId) loadGraph(graphId);
  }, [graphId, loadGraph]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    const list = rows.filter(
      (r) =>
        r.risk_title.toLowerCase().includes(needle) ||
        r.exposure.contextual_description.toLowerCase().includes(needle) ||
        r.linked_actions.join(" ").toLowerCase().includes(needle),
    );
    return list.sort((a, b) => {
      const av =
        sort === "score"
          ? a.exposure.exposure.score ?? -1
          : sort === "likelihood"
            ? a.exposure.likelihood ?? -1
            : sort === "impact"
              ? a.exposure.impact.overall ?? -1
              : String(a[sort as keyof RegisterRow] ?? "");
      const bv =
        sort === "score"
          ? b.exposure.exposure.score ?? -1
          : sort === "likelihood"
            ? b.exposure.likelihood ?? -1
            : sort === "impact"
              ? b.exposure.impact.overall ?? -1
              : String(b[sort as keyof RegisterRow] ?? "");
      if (typeof av === "number" && typeof bv === "number") return bv - av;
      return String(av).localeCompare(String(bv));
    });
  }, [rows, q, sort]);

  return (
    <div className="page">
      <div className="kicker">Familiar surface</div>
      <h1>Risk register</h1>
      <p className="help">
        A table of the same exposures. The graph remains the reasoning surface. This is for scanning and
        editing.
      </p>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter register" />
      <table className="table">
        <thead>
          <tr>
            {["Risk", "Context", "L", "I", "Exposure", "Proximity", "Velocity", "Confidence", "Actions", "Graph"].map(
              (h) => (
                <th key={h} onClick={() => setSort(h === "Exposure" ? "score" : h === "L" ? "likelihood" : h === "I" ? "impact" : "risk_title")}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.exposure.id}>
              <td>
                <Link to={`/risks/${row.exposure.risk_id}`}>{row.risk_title}</Link>
              </td>
              <td>{row.exposure.contextual_description}</td>
              <td>{row.exposure.likelihood ?? "–"}</td>
              <td>{row.exposure.impact.overall ?? "–"}</td>
              <td>
                {row.exposure.exposure.score ?? "–"} {row.exposure.exposure.band ?? ""}
              </td>
              <td>{row.exposure.proximity ?? "–"}</td>
              <td>{row.exposure.velocity ?? "–"}</td>
              <td>{row.exposure.confidence ?? "–"}</td>
              <td>{row.linked_actions.join(", ") || "—"}</td>
              <td>
                <Link
                  to={`/g/${row.graph_id}`}
                  onClick={() => select(`exposure:${row.exposure.id}`)}
                >
                  {row.graph_title}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
