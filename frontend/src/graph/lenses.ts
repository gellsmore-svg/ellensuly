import type { CSSProperties } from "react";
import type { LensId, NodeMetrics, RiskExposure } from "../api/types";

export const LENSES: Array<{ id: LensId; title: string; key: string }> = [
  { id: "exposure", title: "Exposure", key: "1" },
  { id: "impact", title: "Impact", key: "2" },
  { id: "urgency", title: "Urgency", key: "3" },
  { id: "uncertainty", title: "Uncertainty", key: "4" },
  { id: "connectivity", title: "Connectivity", key: "5" },
  { id: "decision", title: "Decision path", key: "6" },
];

export function bandFill(band: string | null | undefined): string {
  switch (band) {
    case "low":
      return "var(--band-low)";
    case "moderate":
      return "var(--band-moderate)";
    case "elevated":
      return "var(--band-elevated)";
    case "high":
      return "var(--band-high)";
    case "extreme":
      return "var(--band-extreme)";
    default:
      return "var(--band-none)";
  }
}

export function exposureStyle(exp: RiskExposure, lens: LensId, metrics?: NodeMetrics) {
  const score = exp.exposure.score;
  const impact = exp.impact.overall ?? 0;
  const style: CSSProperties = {};
  const classes: string[] = [];

  if (lens === "exposure" || lens === "decision") {
    style.background = bandFill(exp.exposure.band);
    style.borderWidth = score && score >= 15 ? 3 : 2;
  }
  if (lens === "impact") {
    style.background = bandFill(
      impact >= 5 ? "extreme" : impact === 4 ? "high" : impact === 3 ? "elevated" : impact === 2 ? "moderate" : impact === 1 ? "low" : null,
    );
    style.borderWidth = 1 + Math.min(impact, 4);
    style.transform = `scale(${1 + Math.min(impact, 5) * 0.03})`;
  }
  if (lens === "uncertainty") {
    if ((exp.confidence ?? 5) <= 2) classes.push("uncertain");
    style.borderWidth = 6 - (exp.confidence ?? 3);
  }
  if (lens === "connectivity" && metrics) {
    const weight = 2 + Math.round(metrics.betweenness_centrality * 6);
    style.borderWidth = Math.min(7, weight);
    if (metrics.structurally_important) style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent) 50%, transparent)";
  }
  return { style, classes };
}

export function urgencyRings(exp: RiskExposure): { inner: number; outer: number } {
  return {
    inner: (exp.proximity ?? 0) / 5,
    outer: (exp.velocity ?? 0) / 5,
  };
}
