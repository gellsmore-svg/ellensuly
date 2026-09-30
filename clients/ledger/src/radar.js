import { s } from "./dom.js";

// Five axes; farther from centre always means more concern (confidence is inverted
// server-side into `uncertainty`). Missing values are drawn as gaps, not zeros.
export const AXES = [
  { key: "likelihood", label: "Likelihood", get: (e) => e.likelihood },
  { key: "impact", label: "Impact", get: (e) => e.impact?.overall },
  { key: "proximity", label: "Immediacy", get: (e) => e.proximity },
  { key: "velocity", label: "Velocity", get: (e) => e.velocity },
  { key: "uncertainty", label: "Uncertainty", get: (e) => e.uncertainty },
];

export function radar(exposure, { size = 220, compare = null } = {}) {
  const c = size / 2;
  const r = size / 2 - 26;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
  const pt = (i, v) => [c + Math.cos(angle(i)) * (r * v) / 5, c + Math.sin(angle(i)) * (r * v) / 5];

  const side = 100; // room for axis labels left and right
  const svg = s("svg", {
    viewBox: `${-side} 0 ${size + side * 2} ${size}`,
    width: size + side * 2,
    height: size,
    class: "radar",
    role: "img",
    "aria-label": "Profile: " + AXES.map((a) => `${a.label} ${a.get(exposure) ?? "not assessed"}`).join(", "),
  });

  for (let level = 1; level <= 5; level++) {
    const ring = AXES.map((_, i) => pt(i, level).join(",")).join(" ");
    svg.append(s("polygon", { points: ring, class: level === 5 ? "radar-ring outer" : "radar-ring" }));
  }
  AXES.forEach((axis, i) => {
    const [x, y] = pt(i, 5);
    svg.append(s("line", { x1: c, y1: c, x2: x, y2: y, class: "radar-spoke" }));
    const [lx, ly] = pt(i, 6);
    const value = axis.get(exposure);
    svg.append(
      s(
        "text",
        { x: lx, y: ly, class: "radar-label", "text-anchor": Math.abs(lx - c) < 4 ? "middle" : lx > c ? "start" : "end", "dominant-baseline": "middle" },
        axis.label,
        s("tspan", { class: "radar-value", dx: 4 }, value ?? "–"),
      ),
    );
  });

  const shape = (e, cls) => {
    const values = AXES.map((a) => a.get(e));
    if (values.every((v) => v == null)) return;
    const points = values.map((v, i) => pt(i, v ?? 0).join(",")).join(" ");
    svg.append(s("polygon", { points, class: cls }));
    values.forEach((v, i) => {
      if (v == null) return;
      const [x, y] = pt(i, v);
      svg.append(s("circle", { cx: x, cy: y, r: 3, class: cls + "-dot" }));
    });
  };
  if (compare) shape(compare, "radar-compare");
  shape(exposure, "radar-shape");
  return svg;
}
