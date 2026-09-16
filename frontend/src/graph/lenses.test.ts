import { describe, expect, it } from "vitest";
import { bandFill, exposureStyle } from "./lenses";
import type { RiskExposure } from "../api/types";

const exp = (over: Partial<RiskExposure> = {}): RiskExposure =>
  ({
    id: "e",
    graph_id: "g",
    risk_id: "r",
    contextual_description: "",
    likelihood: 2,
    impact: { overall: 5, dimensions: {}, overall_source: "user" },
    proximity: 1,
    velocity: 1,
    confidence: 2,
    persistence: null,
    quantitative_likelihood: null,
    assumptions: "",
    evidence: "",
    owner: "",
    status: "open",
    created_at: "",
    modified_at: "",
    exposure: {
      likelihood: 2,
      impact: 5,
      score: 10,
      band: "elevated",
      caveat: "lens",
    },
    uncertainty: 4,
    risk_title: "Severe but unlikely",
    ...over,
  }) as RiskExposure;

describe("visual encoding", () => {
  it("maps bands to CSS variables rather than red-amber-green", () => {
    expect(bandFill("extreme")).toContain("--band-extreme");
    expect(bandFill(null)).toContain("--band-none");
  });

  it("impact lens emphasises high impact even when likelihood is low", () => {
    const { style } = exposureStyle(exp(), "impact");
    expect(String(style.borderWidth)).not.toBe("1");
    expect(String(style.background)).toContain("--band-extreme");
  });

  it("uncertainty lens uses a non-colour channel", () => {
    const { classes } = exposureStyle(exp({ confidence: 1 }), "uncertainty");
    expect(classes).toContain("uncertain");
  });
});
