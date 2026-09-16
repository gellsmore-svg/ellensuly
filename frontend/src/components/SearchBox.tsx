import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { SearchHit } from "../api/types";
import { useApp } from "../state/store";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const nav = useNavigate();
  const select = useApp((s) => s.select);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      api.search(q).then(setHits).catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(hit: SearchHit) {
    setQ("");
    setHits([]);
    if (hit.kind === "graph" && hit.graph_id) nav(`/g/${hit.graph_id}`);
    else if (hit.kind === "risk") nav(`/risks/${hit.id}`);
    else if (hit.graph_id) {
      if (hit.kind === "exposure") select(`exposure:${hit.id}`);
      if (hit.kind === "action") select(`action:${hit.id}`);
      nav(`/g/${hit.graph_id}`);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        className="search"
        placeholder="Search risks, actions, labels"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search"
      />
      {hits.length > 0 && (
        <ul
          style={{
            position: "absolute",
            right: 0,
            top: 36,
            background: "var(--bg-panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            listStyle: "none",
            margin: 0,
            padding: 8,
            width: 320,
            zIndex: 20,
          }}
        >
          {hits.map((h) => (
            <li key={`${h.kind}-${h.id}`}>
              <button className="chip" onClick={() => go(h)}>
                {h.kind}: {h.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
