// Pure functions over the API bundle. No DOM, no fetch — unit-tested under node --test.
//
// Analysis (metrics, cycles, convergence, landscapes) comes from the server. What lives
// here is presentation traversal over edges the server already returned: indexing,
// consequence cascades and the direct/feedback split used to read a landscape.

export const nid = (kind, id) => `${kind}:${id}`;
export const splitNid = (n) => {
  const i = n.indexOf(":");
  return { kind: n.slice(0, i), id: n.slice(i + 1) };
};

export const BANDS = ["low", "moderate", "elevated", "high", "extreme"];

export function indexBundle(bundle) {
  const exposures = new Map(bundle.exposures.map((e) => [e.id, e]));
  const actions = new Map(bundle.actions.map((a) => [a.id, a]));
  const risks = new Map(bundle.risks.map((r) => [r.id, r]));
  const out = new Map();
  const inc = new Map();
  const nodes = [
    ...bundle.exposures.map((e) => nid("exposure", e.id)),
    ...bundle.actions.map((a) => nid("action", a.id)),
  ];
  for (const n of nodes) {
    out.set(n, []);
    inc.set(n, []);
  }
  const edges = [];
  for (const rel of bundle.relationships) {
    const source = nid(rel.source_kind, rel.source_id);
    const target = nid(rel.target_kind, rel.target_id);
    if (!out.has(source) || !out.has(target)) continue;
    const edge = { id: rel.id, source, target, rel };
    edges.push(edge);
    out.get(source).push(edge);
    inc.get(target).push(edge);
    if (rel.directed === false) {
      // Symmetric relations are walkable both ways but never define a direction.
      inc.get(source).push({ ...edge, source: target, target: source, reversed: true });
    }
  }
  const insightsByNode = new Map();
  for (const insight of bundle.analysis.insights || []) {
    if (!insight.node_id) continue;
    if (!insightsByNode.has(insight.node_id)) insightsByNode.set(insight.node_id, []);
    insightsByNode.get(insight.node_id).push(insight);
  }
  return {
    graph: bundle.graph,
    exposures,
    actions,
    risks,
    nodes,
    edges,
    out,
    inc,
    analysis: bundle.analysis,
    metrics: bundle.analysis.metrics || {},
    insightsByNode,
    caveats: bundle.methodology_caveats || [],
  };
}

export function entity(ix, n) {
  const { kind, id } = splitNid(n);
  return kind === "exposure" ? ix.exposures.get(id) : ix.actions.get(id);
}

export function title(ix, n) {
  const e = entity(ix, n);
  if (!e) return n;
  return splitNid(n).kind === "exposure" ? e.risk_title || "(untitled risk)" : e.title;
}

export function verb(rel) {
  if (rel.semantics === "custom" && rel.custom_label) return rel.custom_label;
  return rel.semantics.replace(/_/g, " ");
}

/** Actions recorded as responses to an exposure (has_response edges). */
export function responsesOf(ix, exposureId) {
  return (ix.out.get(nid("exposure", exposureId)) || [])
    .filter((e) => e.rel.semantics === "has_response" && e.target.startsWith("action:"))
    .map((e) => ix.actions.get(splitNid(e.target).id))
    .filter(Boolean);
}

/** Exposures that have at least one response: the decisions this graph contains. */
export function decisionPoints(ix) {
  const focal = ix.graph.focal_exposure_ids || [];
  const withResponses = [...ix.exposures.values()].filter((e) => responsesOf(ix, e.id).length > 0);
  withResponses.sort((a, b) => {
    const fa = focal.includes(a.id) ? 0 : 1;
    const fb = focal.includes(b.id) ? 0 : 1;
    return fa - fb || (ix.metrics[nid("exposure", a.id)]?.depth_from_focal ?? 99) -
      (ix.metrics[nid("exposure", b.id)]?.depth_from_focal ?? 99);
  });
  return withResponses;
}

/**
 * The consequence cascade opened by one node, as a tree for reading.
 *
 * Each child carries the relation that reached it. A node already on the path above
 * (including the decision's own root) is a `feedback` leaf, not expanded again. A node
 * already expanded elsewhere in this tree is a `repeat` leaf. Symmetric relations are
 * not followed: they carry no direction of consequence.
 */
export function cascade(ix, start, { root = null, maxDepth = 12 } = {}) {
  const expanded = new Set();
  const walk = (n, via, ancestors, depth) => {
    const node = { id: n, via, children: [], mark: null, depth };
    if (ancestors.has(n)) {
      node.mark = "feedback";
      return node;
    }
    if (expanded.has(n)) {
      node.mark = "repeat";
      return node;
    }
    expanded.add(n);
    if (depth >= maxDepth) {
      node.mark = "truncated";
      return node;
    }
    const next = new Set(ancestors).add(n);
    for (const edge of ix.out.get(n) || []) {
      if (edge.rel.directed === false) continue;
      node.children.push(walk(edge.target, edge.rel, next, depth + 1));
    }
    return node;
  };
  return walk(start, null, root ? new Set([root]) : new Set(), 0);
}

/** Flatten a cascade into the nodes it reaches directly (excluding feedback leaves). */
export function directReach(tree) {
  const seen = new Set();
  const visit = (node) => {
    if (node.mark === "feedback") return;
    seen.add(node.id);
    node.children.forEach(visit);
  };
  visit(tree);
  return seen;
}

/** Feedback leaves in a cascade: where the branch re-enters something above it. */
export function feedbackTargets(tree) {
  const found = [];
  const visit = (node) => {
    if (node.mark === "feedback") found.push({ id: node.id, via: node.via });
    node.children.forEach(visit);
  };
  visit(tree);
  return found;
}

/**
 * Read a server landscape (compare-actions item) against the direct cascade.
 * `server` is what the API says is reachable; `direct` is reached without
 * passing back through the decision's root or an ancestor.
 */
export function readLandscape(ix, landscape, rootExposureId) {
  const start = nid("action", landscape.action_id);
  const tree = cascade(ix, start, { root: nid("exposure", rootExposureId) });
  const direct = directReach(tree);
  const directExposures = [...direct].filter((n) => n.startsWith("exposure:")).map((n) => splitNid(n).id);
  const serverExposures = landscape.downstream_exposure_ids || [];
  const viaFeedback = serverExposures.filter((id) => !directExposures.includes(id));
  return { tree, directExposures, viaFeedback, feedback: feedbackTargets(tree) };
}

/** Which alternatives' direct landscapes include each exposure. */
export function sharedIndex(readings) {
  const index = new Map();
  for (const [actionId, reading] of readings) {
    for (const expId of reading.directExposures) {
      if (!index.has(expId)) index.set(expId, []);
      index.get(expId).push(actionId);
    }
  }
  return index;
}

export function bandOf(exposure) {
  return exposure?.exposure?.band || null;
}

export function levelName(config, scale, value) {
  if (!config || value == null) return "";
  return config[scale]?.levels?.find((l) => l.value === value)?.name || "";
}

/** Register sorts. Each one is a different question; none is "the" ranking. */
export const SORTS = {
  score: {
    label: "L × I",
    question: "What does the familiar heat-map lens put first?",
    key: (e) => e.exposure?.score ?? -1,
  },
  impact: {
    label: "Impact",
    question: "What would hurt most, however unlikely?",
    key: (e) => e.impact?.overall ?? -1,
  },
  urgency: {
    label: "Urgency",
    question: "What arrives soonest and fastest?",
    key: (e) => (e.proximity ?? 0) * 10 + (e.velocity ?? 0),
  },
  uncertainty: {
    label: "Uncertainty",
    question: "Where is the assessment least supported?",
    key: (e) => e.uncertainty ?? -1,
  },
  reach: {
    label: "Reach",
    question: "What sits upstream of the most other risk?",
    key: (e, ix) => ix.metrics[nid("exposure", e.id)]?.downstream_risk_count ?? -1,
  },
};

export function sortedExposures(ix, sortKey) {
  const sort = SORTS[sortKey] || SORTS.score;
  return [...ix.exposures.values()].sort(
    (a, b) => sort.key(b, ix) - sort.key(a, ix) || (a.risk_title || "").localeCompare(b.risk_title || ""),
  );
}

/** Position of each exposure under each sort, to show how much the order moves. */
export function rankShift(ix, fromKey, toKey) {
  const from = sortedExposures(ix, fromKey).map((e) => e.id);
  const to = sortedExposures(ix, toKey).map((e) => e.id);
  return new Map(to.map((id, i) => [id, from.indexOf(id) - i]));
}
