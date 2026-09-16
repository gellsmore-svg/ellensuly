import type { RiskExposure } from "../api/types";

const AXES = [
  { key: "likelihood", label: "Likelihood" },
  { key: "impact", label: "Impact" },
  { key: "proximity", label: "Immediacy" },
  { key: "velocity", label: "Velocity" },
  { key: "uncertainty", label: "Uncertainty" },
] as const;

function valuesOf(exp: RiskExposure): number[] {
  return [
    exp.likelihood ?? 0,
    exp.impact.overall ?? 0,
    exp.proximity ?? 0,
    exp.velocity ?? 0,
    exp.uncertainty ?? 0,
  ];
}

export function Radar({ exposure }: { exposure: RiskExposure }) {
  const cx = 110;
  const cy = 110;
  const r = 78;
  const vals = valuesOf(exposure);
  const points = vals.map((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
    const rr = (v / 5) * r;
    return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr];
  });
  const poly = points.map((p) => p.join(",")).join(" ");
  return (
    <figure style={{ margin: "12px 0" }}>
      <svg className="radar" viewBox="0 0 220 220" role="img" aria-label={describe(exposure, vals)}>
        {[1, 2, 3, 4, 5].map((ring) => (
          <polygon
            key={ring}
            fill="none"
            stroke="var(--line)"
            points={AXES.map((_, i) => {
              const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
              const rr = (ring / 5) * r;
              return `${cx + Math.cos(angle) * rr},${cy + Math.sin(angle) * rr}`;
            }).join(" ")}
          />
        ))}
        {AXES.map((axis, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
          const x = cx + Math.cos(angle) * (r + 16);
          const y = cy + Math.sin(angle) * (r + 16);
          return (
            <g key={axis.key}>
              <line x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="var(--line)" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" fontSize="10">
                {axis.label}
              </text>
            </g>
          );
        })}
        <polygon points={poly} fill="color-mix(in srgb, var(--accent) 35%, transparent)" stroke="var(--accent)" />
      </svg>
      <figcaption className="help">
        Farther from the centre means more concern. Uncertainty is 6 − confidence. Polygon area is not a score.
      </figcaption>
      <ul className="help">
        {AXES.map((axis, i) => (
          <li key={axis.key}>
            {axis.label}: {vals[i] || "unassessed"}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function describe(exp: RiskExposure, vals: number[]): string {
  return `Risk profile for ${exp.risk_title ?? "exposure"}: likelihood ${vals[0]}, impact ${vals[1]}, immediacy ${vals[2]}, velocity ${vals[3]}, uncertainty ${vals[4]}.`;
}
