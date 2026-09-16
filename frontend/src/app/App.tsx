import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { SearchBox } from "../components/SearchBox";
import { FirstRun } from "../components/FirstRun";
import { useApp } from "../state/store";
import { GraphView } from "../views/GraphView";
import { HeatmapView } from "../views/HeatmapView";
import { HomeView } from "../views/HomeView";
import { RegisterView } from "../views/RegisterView";
import { RiskDetailView, RisksView } from "../views/RisksView";

export function App() {
  const loadMeta = useApp((s) => s.loadMeta);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  const graphMatch = loc.pathname.match(/^\/g\/([^/]+)/);
  const graphId = graphMatch?.[1];
  const presenting = loc.pathname.endsWith("/present");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!presenting && (
        <header className="topbar">
          <NavLink to="/" className="brand">
            <strong>Ellensúly</strong>
            <span>Risk, in context.</span>
          </NavLink>
          <nav className="nav" aria-label="Primary">
            {graphId && (
              <>
                <NavLink to={`/g/${graphId}`} end>
                  Graph
                </NavLink>
                <NavLink to={`/g/${graphId}/register`}>Register</NavLink>
                <NavLink to={`/g/${graphId}/heatmap`}>Heatmap</NavLink>
                <NavLink to={`/g/${graphId}/present`}>Present</NavLink>
              </>
            )}
            <NavLink to="/risks">Risks</NavLink>
          </nav>
          <SearchBox />
          <button className="btn" onClick={() => toggleTheme()} aria-label="Toggle colour theme">
            Theme
          </button>
        </header>
      )}
      {presenting && (
        <header className="topbar">
          <div className="brand">
            <strong>Ellensúly</strong>
            <span>Presentation</span>
          </div>
          <div className="nav" />
          <button className="btn" onClick={() => graphId && nav(`/g/${graphId}`)}>
            Exit presentation
          </button>
        </header>
      )}
      <main id="main" style={{ minHeight: 0, display: "grid" }}>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/g/:graphId" element={<GraphView />} />
          <Route path="/g/:graphId/register" element={<RegisterView />} />
          <Route path="/g/:graphId/heatmap" element={<HeatmapView />} />
          <Route path="/g/:graphId/present" element={<GraphView presentation />} />
          <Route path="/risks" element={<RisksView />} />
          <Route path="/risks/:riskId" element={<RiskDetailView />} />
        </Routes>
      </main>
      {graphId && !presenting && <FirstRun />}
    </div>
  );
}
