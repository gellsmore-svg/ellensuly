import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { DecisionGraph } from "../api/types";

export function HomeView() {
  const [graphs, setGraphs] = useState<DecisionGraph[]>([]);
  const nav = useNavigate();
  useEffect(() => {
    api.graphs().then(setGraphs);
  }, []);

  return (
    <div className="page">
      <p className="kicker">Ellensúly</p>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, maxWidth: 720 }}>
        A response to a risk changes the landscape of other risks.
      </h1>
      <p className="help" style={{ maxWidth: 640 }}>
        Traditional risk management gives us a list. Ellensúly gives us a map: a directed graph of
        exposures, actions and the relationships between them. Counter-risk is not a verdict that an
        action is wrong. It is part of the landscape a decision creates.
      </p>
      <div className="row" style={{ margin: "24px 0" }}>
        <form
          onSubmit={async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const g = await api.createGraph({
              title: String(fd.get("title")),
              objective: String(fd.get("objective") || ""),
            });
            nav(`/g/${g.id}`);
          }}
          className="row"
        >
          <input name="title" required placeholder="New decision graph" className="search" />
          <input name="objective" placeholder="Objective / context" className="search" />
          <button className="btn primary" type="submit">
            Create
          </button>
        </form>
        <button
          className="btn"
          onClick={async () => {
            const seeded = await api.seed();
            await api.graphs().then(setGraphs);
            if (typeof seeded.graph_id === "string") nav(`/g/${seeded.graph_id}`);
          }}
        >
          Load demonstration
        </button>
      </div>
      <ul>
        {graphs.map((g) => (
          <li key={g.id} style={{ margin: "12px 0" }}>
            <Link to={`/g/${g.id}`}>{g.title}</Link>
            <div className="help">{g.objective || g.description}</div>
          </li>
        ))}
      </ul>
      {!graphs.length && (
        <div className="empty">
          <h2>Start with a risk, then ask what the response creates.</h2>
          <p className="help">
            Add a decision graph, place a focal risk, attach alternative actions, and follow the
            resulting exposures. The demonstration supplier-continuity graph shows branching,
            convergence, reuse and a cycle.
          </p>
        </div>
      )}
    </div>
  );
}
