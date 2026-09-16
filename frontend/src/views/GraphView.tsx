import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Drawer } from "../components/Drawer";
import { GraphText, SrOnlyStyle } from "../components/GraphText";
import { GraphCanvas } from "../graph/GraphCanvas";
import { useApp } from "../state/store";
import { LENSES } from "../graph/lenses";

export function GraphView({ presentation = false }: { presentation?: boolean }) {
  const { graphId } = useParams();
  const loadGraph = useApp((s) => s.loadGraph);
  const setLens = useApp((s) => s.setLens);
  const togglePresentation = useApp((s) => s.togglePresentation);
  const bundle = useApp((s) => s.bundle);
  const error = useApp((s) => s.error);
  const loading = useApp((s) => s.loading);

  useEffect(() => {
    if (graphId) loadGraph(graphId);
  }, [graphId, loadGraph]);

  useEffect(() => {
    togglePresentation(presentation);
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const lens = LENSES.find((l) => l.key === e.key);
      if (lens) setLens(lens.id);
      if (e.key === "Escape") useApp.getState().select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presentation, setLens, togglePresentation]);

  if (loading && !bundle) return <div className="page">Loading the decision graph…</div>;
  if (error) return <div className="page">Could not load graph: {error}</div>;
  if (!bundle) return <div className="page">No graph selected.</div>;

  return (
    <div className={`workspace ${presentation ? "presentation" : ""}`}>
      <SrOnlyStyle />
      <GraphCanvas presentation={presentation} />
      <GraphText />
      {!presentation && <Drawer />}
    </div>
  );
}
