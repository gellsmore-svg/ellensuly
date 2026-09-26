import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import { SearchBox } from "../components/SearchBox";
import { FirstRun } from "../components/FirstRun";
import { Icon } from "../components/Icon";
import { useApp } from "../state/store";
import { GraphView } from "../views/GraphView";
import { HeatmapView } from "../views/HeatmapView";
import { HomeView } from "../views/HomeView";
import { RegisterView } from "../views/RegisterView";
import { RiskDetailView, RisksView } from "../views/RisksView";

export function App() {
  const loadMeta = useApp((s) => s.loadMeta);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const theme = useApp((s) => s.theme);
  const bundle = useApp((s) => s.bundle);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);
  const graphId = loc.pathname.match(/^\/g\/([^/]+)/)?.[1];
  const presenting = loc.pathname.endsWith("/present");
  const title = graphId
    ? bundle?.graph.id === graphId
      ? bundle.graph.title
      : "Decision workspace"
    : loc.pathname.startsWith("/risks")
      ? "Risk library"
      : "Overview";

  return (
    <div className={`app-shell ${presenting ? "presenting" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!presenting && (
        <aside className="sidebar">
          <NavLink to="/" className="brand" aria-label="Ellensúly home">
            <span className="brand-mark" aria-hidden="true">
              é
            </span>
            <span>
              <strong>Ellensúly</strong>
              <span className="brand-tagline">Risk, in context.</span>
            </span>
          </NavLink>
          <div className="workspace-label">
            <span className="workspace-avatar">E</span>
            <div>
              Decision workspace<small>Your risk landscape</small>
            </div>
          </div>
          <div className="sidebar-section">WORKSPACE</div>
          <nav className="side-nav" aria-label="Primary">
            <NavLink to="/" end>
              <Icon name="grid" />
              Overview
            </NavLink>
            <NavLink to="/risks">
              <Icon name="risk" />
              Risk library
            </NavLink>
          </nav>
          {graphId && (
            <>
              <div className="sidebar-section">CURRENT DECISION</div>
              <nav className="side-nav" aria-label="Decision views">
                <NavLink to={`/g/${graphId}`} end>
                  <Icon name="graph" />
                  Graph
                </NavLink>
                <NavLink to={`/g/${graphId}/register`}>
                  <Icon name="table" />
                  Register
                </NavLink>
                <NavLink to={`/g/${graphId}/heatmap`}>
                  <Icon name="chart" />
                  Heatmap
                </NavLink>
                <NavLink to={`/g/${graphId}/present`}>
                  <Icon name="present" />
                  Present
                </NavLink>
              </nav>
            </>
          )}
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <Icon name="graph" />
              <p>
                Every response opens
                <br />a new landscape.
              </p>
              <span>Make the connections visible.</span>
            </div>
            <a
              className="guide-link"
              href="https://github.com/gellsmore-svg/ellensuly/blob/main/docs/risk-methodology.md"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="book" />A guide to Ellensúly
              <Icon name="arrow" size={16} />
            </a>
            <button className="theme-toggle" onClick={toggleTheme}>
              <Icon name="sun" />
              {theme === "dark" ? "Light appearance" : "Dark appearance"}
            </button>
          </div>
        </aside>
      )}
      <header className="topbar">
        <div className="breadcrumb">
          <span>Ellensúly</span>
          <span className="breadcrumb-slash">/</span>
          <strong>{presenting ? "Presentation" : title}</strong>
        </div>
        {presenting ? (
          <button className="btn" onClick={() => nav(`/g/${graphId}`)}>
            Exit presentation
          </button>
        ) : (
          <SearchBox />
        )}
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/g/:graphId" element={<GraphView />} />
          <Route path="/g/:graphId/register" element={<RegisterView />} />
          <Route path="/g/:graphId/heatmap" element={<HeatmapView />} />
          <Route
            path="/g/:graphId/present"
            element={<GraphView presentation />}
          />
          <Route path="/risks" element={<RisksView />} />
          <Route path="/risks/:riskId" element={<RiskDetailView />} />
          <Route
            path="*"
            element={
              <div className="page">
                <h1>Page not found</h1>
                <NavLink to="/">Return to overview</NavLink>
              </div>
            }
          />
        </Routes>
      </main>
      {graphId && !presenting && <FirstRun />}
    </div>
  );
}
