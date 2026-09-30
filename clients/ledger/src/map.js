// The decision graph as SVG. Same visual grammar as docs/visual-language.md, drawn
// independently: rounded rectangles for exposures, pills for actions, verbs on edges,
// one lens at a time. Cycles are drawn as return arcs under the flow.

import { h, s } from "./dom.js";
import { BANDS, entity, splitNid, title, verb } from "./model.js";

export const LENSES = ["exposure", "impact", "urgency", "uncertainty", "connectivity", "decision"];

const EXPOSURE = { w: 196, h: 66 };
const ACTION = { w: 184, h: 54 };
export const nodeSize = (n) => (n.startsWith("action:") ? ACTION : EXPOSURE);

const COOLING = new Set(["decreases", "delays", "contains", "removes", "suppresses"]);

export function edgeFamily(rel, taxonomy) {
  const meta = taxonomy?.relationship_semantics?.[rel.semantics];
  if (rel.semantics === "has_response") return "response";
  if (COOLING.has(rel.semantics)) return "cooling";
  if (meta?.counter_risk) return "counter";
  return meta?.family === "causal" ? "causal" : "other";
}

function wrap(text, max, lines = 2) {
  const words = String(text).split(/\s+/);
  const out = [""];
  for (const word of words) {
    const line = out[out.length - 1];
    if ((line + " " + word).trim().length <= max) out[out.length - 1] = (line + " " + word).trim();
    else if (out.length < lines) out.push(word);
    else {
      out[out.length - 1] = line.replace(/.{0,1}$/, "…");
      break;
    }
  }
  return out;
}

function curve(points) {
  const pts = points.map((p) => [p.cx, p.cy]);
  const first = points[0];
  const last = points[points.length - 1];
  pts[0] = [first.x + first.w, first.cy];
  pts[pts.length - 1] = [last.x, last.cy];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

function returnArc(from, to, lane) {
  // Leave from the bottom of the later node, run under the flow, enter the earlier node from below.
  const x0 = from.cx;
  const y0 = from.y + from.h;
  const x1 = to.cx + 12;
  const y1 = to.y + to.h;
  const dip = Math.max(y0, y1) + 34 + lane * 18;
  return { d: `M${x0},${y0} C${x0},${dip} ${x1},${dip} ${x1},${y1 + 6}`, mid: [(x0 + x1) / 2, dip - 6] };
}

function nodeGroup(ix, n, p, ctx) {
  const { kind } = splitNid(n);
  const e = entity(ix, n);
  const m = ix.metrics[n] || {};
  const g = s("g", {
    class: `node ${kind}`,
    transform: `translate(${p.x},${p.y})`,
    tabindex: 0,
    role: "button",
    "data-node": n,
    "aria-label": `${kind === "action" ? "Action" : "Risk exposure"}: ${title(ix, n)}`,
    "aria-pressed": ctx.selected === n ? "true" : "false",
  });
  g.addEventListener("click", () => ctx.onSelect(n));
  g.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      ctx.onSelect(n);
    }
  });

  const lens = ctx.lens;
  const classes = ["shape"];
  let strokeWidth = 1.25;
  let fillBand = null;

  if (kind === "exposure") {
    if (lens === "exposure") fillBand = e.exposure?.band;
    if (lens === "impact" && e.impact?.overall) {
      fillBand = BANDS[e.impact.overall - 1];
      strokeWidth = 0.5 + e.impact.overall;
    }
    if (lens === "uncertainty" && (e.uncertainty ?? 0) >= 3) classes.push("uncertain", `u${e.uncertainty}`);
  }
  if (lens === "connectivity") strokeWidth = 1 + Math.min(6, (m.betweenness_centrality || 0) * 60);
  if (fillBand) classes.push(`fill-${fillBand}`);

  const rx = kind === "action" ? p.h / 2 : 10;

  if (lens === "urgency" && kind === "exposure") {
    const velocity = e.velocity ?? 0;
    const proximity = e.proximity ?? 0;
    if (velocity) g.append(s("rect", { x: -5, y: -5, width: p.w + 10, height: p.h + 10, rx: rx + 5, class: "ring outer", "stroke-width": velocity * 0.9 }));
    if (proximity) g.append(s("rect", { x: 5, y: 5, width: p.w - 10, height: p.h - 10, rx: Math.max(3, rx - 5), class: "ring inner", "stroke-width": proximity * 0.9 }));
  }

  g.append(s("rect", { width: p.w, height: p.h, rx, class: classes.join(" "), "stroke-width": strokeWidth }));
  if (classes.includes("uncertain")) g.append(s("rect", { width: p.w, height: p.h, rx, class: "hatch", fill: "url(#hatch)" }));

  const textX = kind === "action" ? p.w / 2 : 12;
  const anchor = kind === "action" ? "middle" : "start";
  const kicker = kind === "action" ? (e.treatment_category || "action").replace(/_/g, " ") : "exposure";
  const lines = wrap(title(ix, n), kind === "action" ? 25 : 23, 2);
  const shift = kind === "action" && lines.length === 1 ? 7 : 0;
  g.append(s("text", { x: textX, y: (kind === "action" ? 15 : 17) + shift, class: "kicker", "text-anchor": anchor }, kicker));
  lines.forEach((line, i) =>
    g.append(s("text", { x: textX, y: (kind === "action" ? 30 : 35) + shift + i * 14.5, class: "label", "text-anchor": anchor }, line)),
  );

  if (kind === "exposure") {
    let badge = null;
    if (lens === "exposure" || lens === "decision") badge = e.exposure?.score != null ? String(e.exposure.score) : "–";
    if (lens === "impact") badge = e.impact?.overall != null ? `I${e.impact.overall}` : "I–";
    if (lens === "urgency") badge = `P${e.proximity ?? "–"} V${e.velocity ?? "–"}`;
    if (lens === "uncertainty") badge = `C${e.confidence ?? "–"}`;
    if (lens === "connectivity") badge = `↓${m.downstream_risk_count ?? 0}`;
    if (badge) {
      const bw = Math.max(26, badge.length * 7.5 + 10);
      const band = lens === "exposure" || lens === "decision" ? e.exposure?.band : lens === "impact" && e.impact?.overall ? BANDS[e.impact.overall - 1] : null;
      g.append(s("rect", { x: p.w - bw - 8, y: 7, width: bw, height: 18, rx: 9, class: `badge ${band ? "band-" + band : "plain"}` }));
      g.append(s("text", { x: p.w - bw / 2 - 8, y: 20, class: "badge-text", "text-anchor": "middle" }, badge));
    }
  } else if (e.decision_status && e.decision_status !== "proposed") {
    g.append(s("text", { x: p.w / 2, y: p.h + 13, class: "status-note", "text-anchor": "middle" }, e.decision_status.replace(/_/g, " ")));
  }

  if (lens === "connectivity") {
    const marks = [];
    if (m.is_convergence) marks.push(["⊕", "Convergence point"]);
    if (m.cycle_member) marks.push(["↺", "On a cycle"]);
    if (m.structurally_important) marks.push(["◆", "Structurally important"]);
    marks.forEach(([glyph, label], i) => {
      const t = s("text", { x: p.w - 10 - i * 16, y: p.h - 8, class: "struct-mark", "text-anchor": "end" }, glyph);
      t.append(s("title", {}, label));
      g.append(t);
    });
  }

  g.append(s("title", {}, title(ix, n)));
  return g;
}

export function renderMap(ix, lay, ctx) {
  const pad = 40;
  const lanesNeeded = lay.back.size;
  const width = lay.width + pad * 2;
  const height = lay.height + pad * 2 + 40 + lanesNeeded * 18;
  const zoom = ctx.zoom || 1;
  const svg = s("svg", {
    viewBox: `${-pad} ${-pad} ${width} ${height}`,
    width: width * zoom,
    height: height * zoom,
    class: `map lens-${ctx.lens}`,
    role: "group",
    "aria-label": `Decision graph, ${ctx.lens} lens`,
  });

  const defs = s("defs");
  for (const fam of ["response", "counter", "cooling", "causal", "other"]) {
    defs.append(
      s("marker", { id: `arrow-${fam}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
        s("path", { d: "M0,0 L10,5 L0,10 z", class: `arrowhead ${fam}` })),
    );
  }
  defs.append(
    s("pattern", { id: "hatch", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
      s("line", { x1: 0, y1: 0, x2: 0, y2: 7, class: "hatch-line" })),
  );
  svg.append(defs);

  const dim = (n) => {
    if (ctx.lens !== "decision" || !ctx.decision) return "";
    if (ctx.decision.direct.has(n)) return "lit";
    if (ctx.decision.feedback.has(n)) return "half";
    return "dimmed";
  };

  const edgeLayer = s("g", { class: "edges" });
  const labelLayer = s("g", { class: "edge-labels" });
  let lane = 0;
  for (const edge of ix.edges) {
    const fam = edgeFamily(edge.rel, ctx.taxonomy);
    const both = [dim(edge.source), dim(edge.target)];
    const edgeDim = both.includes("dimmed") ? "dimmed" : both.includes("half") ? "half" : "";
    const hot = ctx.selected && (edge.source === ctx.selected || edge.target === ctx.selected) ? "hot" : "";
    let d;
    let mid;
    if (lay.back.has(edge.id)) {
      const arc = returnArc(lay.positions.get(edge.source), lay.positions.get(edge.target), lane++);
      d = arc.d;
      mid = arc.mid;
    } else {
      const route = lay.routes.get(edge.id);
      if (!route) continue;
      d = curve(route);
      const a = route[Math.floor((route.length - 1) / 2)];
      const b = route[Math.ceil((route.length - 1) / 2)];
      const ax = route.length === 2 ? a.x + a.w : a.cx;
      const bx = route.length === 2 ? b.x : b.cx;
      mid = [(ax + bx) / 2, (a.cy + b.cy) / 2];
    }
    const cls = ["edge", fam, lay.back.has(edge.id) ? "back" : "", edge.rel.directed === false ? "undirected" : "", edgeDim, hot].join(" ");
    edgeLayer.append(
      s("path", { d, class: cls, "marker-end": edge.rel.directed === false ? null : `url(#arrow-${fam})` }, s("title", {}, `${title(ix, edge.source)} ${verb(edge.rel)} ${title(ix, edge.target)}`)),
    );
    const text = (lay.back.has(edge.id) ? "↺ " : "") + verb(edge.rel);
    const label = s("g", { class: `edge-label ${fam} ${edgeDim} ${hot}`, transform: `translate(${mid[0]},${mid[1]})` });
    const w = text.length * 6.4 + 10;
    label.append(s("rect", { x: -w / 2, y: -9, width: w, height: 17, rx: 3 }));
    label.append(s("text", { "text-anchor": "middle", y: 4 }, text));
    labelLayer.append(label);
  }
  svg.append(edgeLayer, labelLayer);

  const nodeLayer = s("g", { class: "nodes" });
  for (const n of ix.nodes) {
    const p = lay.positions.get(n);
    if (!p) continue;
    const g = nodeGroup(ix, n, p, ctx);
    const state = dim(n);
    if (state) g.classList.add(state);
    if (ctx.selected === n) g.classList.add("selected");
    if ((ix.graph.focal_exposure_ids || []).includes(splitNid(n).id)) g.classList.add("focal");
    nodeLayer.append(g);
  }
  svg.append(nodeLayer);
  return svg;
}

/** The same graph as text, for screen readers and for anyone who reads faster than they scan. */
export function textualGraph(ix) {
  return h(
    "ol.visually-hidden",
    { "aria-label": "Every relationship in this graph" },
    ix.edges.map((e) => h("li", `${title(ix, e.source)} — ${verb(e.rel)} → ${title(ix, e.target)}`)),
  );
}
