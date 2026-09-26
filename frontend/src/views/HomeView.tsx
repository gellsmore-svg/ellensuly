import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { DecisionGraph } from "../api/types";
import { Icon } from "../components/Icon";

function LandscapeIllustration() {
  return (
    <div
      className="landscape-illustration"
      aria-label="Example: supplier delay leads to alternative responses and resulting risks"
      role="img"
    >
      <div className="illustration-caption">
        <span className="live-dot" /> A DECISION, IN CONTEXT
      </div>
      <svg
        className="landscape-lines"
        viewBox="0 0 500 230"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="example-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0 0 6 3 0 6" fill="#8b957b" />
          </marker>
        </defs>
        <g stroke="#8b957b" strokeWidth="1.3" markerEnd="url(#example-arrow)">
          <path d="M154 112H180Q197 112 197 92V58H238" />
          <path d="M154 112H180Q197 112 197 132V177H238" />
          <path d="M365 58h22q15 0 15 20v25" />
          <path d="M365 177h22q15 0 15-20v-19" />
        </g>
        <text x="195" y="32" className="diagram-label">
          respond
        </text>
        <text x="396" y="59" className="diagram-label">
          creates
        </text>
      </svg>
      <div className="example-node example-risk">
        <small>RISK EXPOSURE</small>
        <strong>Supplier delay</strong>
        <span>Likelihood 4 · Impact 4</span>
      </div>
      <div className="example-node example-action first">
        <small>MITIGATE</small>
        <strong>Second supplier</strong>
      </div>
      <div className="example-node example-action second">
        <small>AVOID</small>
        <strong>Bring in-house</strong>
      </div>
      <div className="example-node example-result">
        <small>RESULTING RISK</small>
        <strong>Capacity loss</strong>
      </div>
      <div className="illustration-footer">
        <span /> Exposure <i /> Action <span className="line-swatch" />{" "}
        Relationship
      </div>
    </div>
  );
}

export function HomeView() {
  const [graphs, setGraphs] = useState<DecisionGraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const dialog = useRef<HTMLDialogElement>(null);
  const nav = useNavigate();
  const load = () => {
    setLoading(true);
    setError("");
    api
      .graphs()
      .then(setGraphs)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Could not load decisions.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const visible = graphs
    .filter((g) =>
      `${g.title} ${g.objective} ${g.description}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : b.modified_at.localeCompare(a.modified_at),
    );
  const openCreate = () => {
    setFormError("");
    dialog.current?.showModal();
  };
  async function demo() {
    setBusy(true);
    setError("");
    try {
      const seeded = await api.seed();
      if (typeof seeded.graph_id === "string") nav(`/g/${seeded.graph_id}`);
      else load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load demonstration.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title")).trim();
    if (!title) {
      setFormError("Give your decision a name.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const graph = await api.createGraph({
        title,
        objective: String(fd.get("objective") || "").trim(),
      });
      nav(`/g/${graph.id}`);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not create decision.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page overview-page">
      <div className="page-heading">
        <div>
          <div className="kicker">YOUR WORKSPACE</div>
          <h1>See the bigger picture.</h1>
          <p className="muted">
            Explore your decisions. Understand what comes next.
          </p>
        </div>
        <button className="btn primary" onClick={openCreate}>
          <Icon name="plus" size={18} />
          New decision
        </button>
      </div>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <div className="eyebrow">
            <span /> CONNECTED THINKING. CLEARER DECISIONS.
          </div>
          <h2 id="welcome-title">
            Every action changes
            <br />
            the landscape.
          </h2>
          <p>
            A response to a risk changes the landscape of other risks. Map the
            connections, explore your options, and see what each decision
            creates.
          </p>
          <button className="btn demo-button" onClick={demo} disabled={busy}>
            Load demonstration
            <Icon name="arrow" size={18} />
          </button>
          <span className="demo-note">
            Explore the supplier continuity example
          </span>
        </div>
        <LandscapeIllustration />
      </section>
      <section className="workspace-facts" aria-label="Workspace summary">
        <div>
          <span className="fact-icon">
            <Icon name="graph" />
          </span>
          <div>
            <span>Decision graphs</span>
            <strong>
              {loading || error
                ? "—"
                : graphs.length.toString().padStart(2, "0")}
            </strong>
          </div>
          <small>Your mapped landscapes</small>
        </div>
        <div>
          <span className="fact-icon">
            <Icon name="risk" />
          </span>
          <div>
            <span>Focal exposures</span>
            <strong>
              {loading || error
                ? "—"
                : graphs
                    .reduce((n, g) => n + g.focal_exposure_ids.length, 0)
                    .toString()
                    .padStart(2, "0")}
            </strong>
          </div>
          <small>Where your decisions begin</small>
        </div>
        <div className="fact-note">
          <Icon name="graph" />
          <p>
            A risk is a starting point.
            <br />
            <strong>The connections tell the story.</strong>
          </p>
        </div>
      </section>
      <section className="decisions-section" aria-labelledby="decisions-title">
        <div className="section-heading">
          <div>
            <h2 id="decisions-title">
              Your decisions <span className="count-pill">{graphs.length}</span>
            </h2>
            <p className="muted">
              A space for every decision worth understanding.
            </p>
          </div>
          <label className="sort-control">
            Sort by
            <select
              aria-label="Sort decisions"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Recently updated</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        <div className="decision-filter">
          <Icon name="search" size={18} />
          <input
            aria-label="Filter decisions"
            placeholder="Find a decision…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span>
            {visible.length} {visible.length === 1 ? "decision" : "decisions"}
          </span>
        </div>
        {error && (
          <div className="error-notice" role="alert">
            <p>Could not load your workspace. {error}</p>
            <button className="btn" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {loading ? (
          <div className="loading-state" role="status">
            Loading your decisions…
          </div>
        ) : (
          !error && (
            <div className="decision-grid">
              {visible.map((g, index) => (
                <Link className="decision-card" to={`/g/${g.id}`} key={g.id}>
                  <div className="card-topline">
                    <span className="card-icon">
                      <Icon name="graph" size={22} />
                    </span>
                    <span className="card-type">DECISION GRAPH</span>
                    <Icon name="arrow" size={19} />
                  </div>
                  <h3>{g.title}</h3>
                  <p>
                    {g.objective ||
                      g.description ||
                      "Start with a risk and explore the landscape of possible responses."}
                  </p>
                  <div className="mini-landscape" aria-hidden="true">
                    <span />
                    <i />
                    <span />
                    <i />
                    <span />
                    <i />
                    <span />
                  </div>
                  <div className="card-footer">
                    <span>
                      {g.focal_exposure_ids.length} focal{" "}
                      {g.focal_exposure_ids.length === 1
                        ? "exposure"
                        : "exposures"}
                    </span>
                    <span>
                      <Icon name="clock" size={13} />
                      {Number.isNaN(Date.parse(g.modified_at))
                        ? `Decision ${index + 1}`
                        : new Date(g.modified_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                    </span>
                  </div>
                </Link>
              ))}
              {!filter && (
                <button className="new-decision-card" onClick={openCreate}>
                  <span>
                    <Icon name="plus" size={24} />
                  </span>
                  <strong>Map a new decision</strong>
                  <p>
                    Start with a risk.
                    <br />
                    See where the possibilities lead.
                  </p>
                </button>
              )}
              {filter && !visible.length && (
                <div className="loading-state">
                  No decisions match “{filter}”.{" "}
                  <button className="btn" onClick={() => setFilter("")}>
                    Clear filter
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </section>
      <footer className="overview-footer">
        <span>ELLENSÚLY</span>
        <p>
          A counter-risk isn’t a reason to stop. It’s a reason to look closer.
        </p>
        <span>Risk, connected.</span>
      </footer>
      <dialog
        ref={dialog}
        className="create-dialog"
        aria-labelledby="create-title"
      >
        <form onSubmit={create}>
          <div className="section-heading">
            <span className="card-icon">
              <Icon name="graph" />
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Close new decision"
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <h2 id="create-title">Make space for a decision.</h2>
          <p className="help">
            Give your graph a name and a little context. You can add risks and
            responses next.
          </p>
          <div className="field">
            <label htmlFor="decision-title">Decision name</label>
            <input
              id="decision-title"
              name="title"
              required
              autoFocus
              placeholder="e.g. Supplier continuity"
            />
          </div>
          <div className="field">
            <label htmlFor="decision-objective">
              Objective or context <span className="muted">(optional)</span>
            </label>
            <textarea
              id="decision-objective"
              name="objective"
              rows={3}
              placeholder="What are you trying to achieve?"
            />
          </div>
          {formError && (
            <p role="alert" className="error-notice">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="btn"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button className="btn primary" disabled={busy} type="submit">
              {busy ? "Creating…" : "Create decision"}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
