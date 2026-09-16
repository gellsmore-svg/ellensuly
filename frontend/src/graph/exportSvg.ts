import type { GraphBundle } from "../api/types";
import { nodeKey } from "../api/types";

export function graphToSvg(bundle: GraphBundle, positions: Record<string, { x: number; y: number }>): string {
  const width = 1600;
  const height = 900;
  const nodes = [
    ...bundle.exposures.map((e) => ({
      id: nodeKey("exposure", e.id),
      label: e.risk_title ?? "Risk",
      kind: "exposure" as const,
      sub: `L${e.likelihood ?? "–"} × I${e.impact.overall ?? "–"}`,
    })),
    ...bundle.actions.map((a) => ({
      id: nodeKey("action", a.id),
      label: a.title,
      kind: "action" as const,
      sub: a.treatment_category,
    })),
  ];
  const edges = bundle.relationships.map((r) => ({
    from: nodeKey(r.source_kind, r.source_id),
    to: nodeKey(r.target_kind, r.target_id),
    label: r.custom_label || r.semantics.replaceAll("_", " "),
  }));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="100%" height="100%" fill="#12151a"/>`,
    `<text x="32" y="40" fill="#e8ecef" font-family="Georgia, serif" font-size="22">${escapeXml(bundle.graph.title)}</text>`,
    `<text x="32" y="62" fill="#93a0ab" font-family="sans-serif" font-size="12">Ellensúly — Risk, in context.</text>`,
  ];
  for (const e of edges) {
    const a = positions[e.from] ?? { x: 80, y: 80 };
    const b = positions[e.to] ?? { x: 200, y: 80 };
    parts.push(
      `<line x1="${a.x + 110}" y1="${a.y + 40}" x2="${b.x + 20}" y2="${b.y + 40}" stroke="#8aa0b0" marker-end="url(#arrow)"/>`,
      `<text x="${(a.x + b.x) / 2 + 60}" y="${(a.y + b.y) / 2 + 32}" fill="#93a0ab" font-size="10">${escapeXml(e.label)}</text>`,
    );
  }
  parts.push(`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#8aa0b0"/></marker></defs>`);
  for (const n of nodes) {
    const p = positions[n.id] ?? { x: 40, y: 80 };
    if (n.kind === "action") {
      parts.push(
        `<rect x="${p.x}" y="${p.y}" rx="24" ry="24" width="196" height="52" fill="#24303a" stroke="#8aa0b0"/>`,
        `<text x="${p.x + 98}" y="${p.y + 22}" text-anchor="middle" fill="#93a0ab" font-size="9">ACTION</text>`,
        `<text x="${p.x + 98}" y="${p.y + 38}" text-anchor="middle" fill="#e8ecef" font-size="12">${escapeXml(n.label)}</text>`,
      );
    } else {
      parts.push(
        `<rect x="${p.x}" y="${p.y}" rx="16" ry="16" width="228" height="88" fill="#1c2229" stroke="#4a5560"/>`,
        `<text x="${p.x + 14}" y="${p.y + 22}" fill="#93a0ab" font-size="9">RISK EXPOSURE</text>`,
        `<text x="${p.x + 14}" y="${p.y + 44}" fill="#e8ecef" font-size="13">${escapeXml(n.label)}</text>`,
        `<text x="${p.x + 14}" y="${p.y + 68}" fill="#c4a35a" font-size="11">${escapeXml(n.sub)}</text>`,
      );
    }
  }
  parts.push("</svg>");
  return parts.join("\n");
}

function escapeXml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
