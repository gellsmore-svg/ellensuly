import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { RegisterRow } from "../api/types";
import { bandFill } from "../graph/lenses";
import { useApp } from "../state/store";

export function HeatmapView() {
  const { graphId } = useParams();
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const select = useApp((s) => s.select);
  useEffect(() => {
    api.register(graphId).then(setRows);
  }, [graphId]);

  const cells: RegisterRow[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []));
  for (const row of rows) {
    const l = row.exposure.likelihood;
    const i = row.exposure.impact.overall;
    if (!l || !i) continue;
    cells[5 - i][l - 1].push(row);
  }

  return (
    <div className="page">
      <div className="kicker">One lens</div>
      <h1>Likelihood × impact</h1>
      <p className="help">
        A conventional heatmap. It is a familiar entry point, not the definition of risk. Open a cell to
        return to the graph.
      </p>
      <div className="heatmap" role="grid" aria-label="Likelihood by impact heatmap">
        <div />
        {[1, 2, 3, 4, 5].map((l) => (
          <div key={l} className="help" style={{ textAlign: "center" }}>
            L {l}
          </div>
        ))}
        {cells.map((row, ri) => (
          <div key={`row-${ri}`} style={{ display: "contents" }}>
            <div className="help">
              I {5 - ri}
            </div>
            {row.map((cell, ci) => {
              const score = (5 - ri) * (ci + 1);
              const band =
                score <= 4 ? "low" : score <= 9 ? "moderate" : score <= 14 ? "elevated" : score <= 19 ? "high" : "extreme";
              return (
                <div key={`${ri}-${ci}`} className="heat-cell" style={{ background: bandFill(band) }} role="gridcell">
                  <div className="help">
                    {score} · {band}
                  </div>
                  {cell.map((item) => (
                    <Link
                      key={item.exposure.id}
                      to={`/g/${item.graph_id}`}
                      onClick={() => select(`exposure:${item.exposure.id}`)}
                    >
                      {item.risk_title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
