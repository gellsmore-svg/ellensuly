import { useApp } from "../state/store";

export function Legend({ presentation = false }: { presentation?: boolean }) {
  const lens = useApp((s) => s.lens);
  return (
    <aside className={`legend ${presentation ? "present-legend-wide" : ""}`} aria-label="Graph legend">
      <div className="kicker">Legend</div>
      <p>
        <span className="badge" style={{ borderRadius: 8, padding: "2px 10px" }}>
          rounded
        </span>{" "}
        Risk exposure
      </p>
      <p>
        <span className="badge" style={{ borderRadius: 999, padding: "2px 10px" }}>
          pill
        </span>{" "}
        Action
      </p>
      <p>Arrows show direction. Edge words are the relationship.</p>
      {lens === "exposure" && <p>Fill follows likelihood × impact. The number on the node is the same lens, not a scientific ratio.</p>}
      {lens === "impact" && <p>Fill and border weight follow impact, even when likelihood is low.</p>}
      {lens === "urgency" && <p>Inner ring: proximity (when). Outer ring: velocity (how fast after onset).</p>}
      {lens === "uncertainty" && <p>Dashed, hatched borders mark low confidence. That is not high likelihood.</p>}
      {lens === "connectivity" && <p>Thicker borders sit on more paths. “Converges” and “cycle” are structural facts.</p>}
      {lens === "decision" && <p>The chosen action’s landscape stays bright. Other branches recede; they are not deleted.</p>}
    </aside>
  );
}
