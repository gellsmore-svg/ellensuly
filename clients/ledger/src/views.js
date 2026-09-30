import { h } from "./dom.js";
import { LENSES, renderMap, textualGraph } from "./map.js";
import {
  BANDS,
  SORTS,
  bandOf,
  decisionPoints,
  entity,
  levelName,
  nid,
  rankShift,
  responsesOf,
  sortedExposures,
  splitNid,
  title,
  verb,
} from "./model.js";
import { radar } from "./radar.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const human = (s) => String(s || "").replace(/_/g, " ");

// ---------------------------------------------------------------- small parts

export function chip(exposure, { compact = false } = {}) {
  const band = bandOf(exposure);
  const score = exposure?.exposure?.score;
  return h(
    `span.chip.band-${band || "none"}`,
    { title: band ? `L${exposure.likelihood} × I${exposure.impact?.overall} = ${score} (${band}) — a prioritisation lens, not a ratio` : "Not yet assessed" },
    score ?? "–",
    compact ? null : h("span.chip-band", band || "unassessed"),
  );
}

function letter(i) {
  return h("span.letter", { "aria-hidden": "true" }, LETTERS[i] || "?");
}

function select(options, value, onchange, attrs = {}) {
  return h(
    "select",
    { ...attrs, onchange: (ev) => onchange(ev.target.value) },
    options.map(([v, label]) => h("option", { value: v, selected: v === value }, label)),
  );
}

function nodeRef(app, n, content) {
  return h(
    "button.node-ref",
    { type: "button", onclick: () => app.select(n), "aria-pressed": app.state.selected === n ? "true" : "false" },
    content ?? title(app.state.ix, n),
  );
}

function field(label, control, hint) {
  return h("label.field", h("span.field-label", label), control, hint ? h("span.field-hint", hint) : null);
}

function empty(text, ...actions) {
  return h("div.empty", h("p", text), actions.length ? h("div.empty-actions", actions) : null);
}

// ---------------------------------------------------------------- home

export function homeView(app) {
  const { graphs, health } = app.state;
  return h(
    "div.home",
    h(
      "section.home-intro",
      h("h1", "Risk, in context."),
      h(
        "p.lede",
        "Acting on a risk changes the risk landscape. This ledger reads each decision as a set of alternatives, " +
          "and follows what every alternative sets in motion — without pretending to add it up.",
      ),
      health ? h("p.meta", `API ${health.version} · store: ${health.store}`) : null,
    ),
    h(
      "section.home-list",
      h("div.section-head", h("h2", "Decisions"), h("div.section-tools",
        h("button.btn", { type: "button", onclick: () => app.dialogs.newGraph() }, "New decision"),
        h("button.btn.ghost", { type: "button", onclick: () => app.reseed() }, "Reload demo"),
      )),
      graphs.length
        ? h(
            "ol.ledger",
            graphs.map((g) =>
              h(
                "li.ledger-row",
                h("a.ledger-title", { href: `#/g/${encodeURIComponent(g.id)}` }, g.title),
                h("p.ledger-desc", g.description || g.objective || "No description yet."),
                h("span.ledger-meta", `modified ${new Date(g.modified_at).toLocaleDateString()}`),
              ),
            ),
          )
        : empty("No decisions yet.", h("button.btn", { type: "button", onclick: () => app.dialogs.newGraph() }, "Start one")),
    ),
  );
}

// ---------------------------------------------------------------- graph shell

const TABS = [
  ["alternatives", "Alternatives"],
  ["map", "Map"],
  ["register", "Register"],
  ["insights", "Structure"],
];

export function graphHeader(app) {
  const { ix, tab } = app.state;
  const a = ix.analysis;
  return h(
    "header.graph-head",
    h(
      "div.graph-title",
      h("h1", ix.graph.title),
      ix.graph.objective ? h("p.objective", h("span.kicker", "Objective"), " ", ix.graph.objective) : null,
      h(
        "p.counts",
        `${a.exposure_count} exposures · ${a.action_count} actions · ${a.relationship_count} relationships`,
        a.cycles.length ? ` · ${a.cycles.length} cycle${a.cycles.length > 1 ? "s" : ""}` : "",
        a.convergence_points.length ? ` · ${a.convergence_points.length} convergence points` : "",
      ),
    ),
    h(
      "div.graph-tools",
      h("button.btn.ghost", { type: "button", onclick: () => app.dialogs.editGraph() }, "Edit"),
      h("button.btn.ghost", { type: "button", onclick: () => app.dialogs.addExposure() }, "Add exposure"),
    ),
    h(
      "nav.tabs",
      { "aria-label": "Views" },
      TABS.map(([id, label]) =>
        h("a.tab", { href: `#/g/${encodeURIComponent(ix.graph.id)}/${id}`, "aria-current": tab === id ? "page" : null }, label),
      ),
    ),
  );
}

// ---------------------------------------------------------------- alternatives

function cascadeRows(app, node, ctx) {
  const { ix } = app.state;
  const n = node.id;
  const kind = splitNid(n).kind;
  const e = entity(ix, n);
  const shared = kind === "exposure" ? (ctx.shared.get(splitNid(n).id) || []).filter((id) => id !== ctx.actionId) : [];
  const cooling = node.via && ["decreases", "delays", "contains", "removes", "suppresses"].includes(node.via.semantics);

  let note = null;
  if (node.mark === "feedback") {
    note = n === ctx.root
      ? h("span.note.back", `acts back on the risk being decided`)
      : h("span.note.back", "↺ feeds back into this branch");
  } else if (node.mark === "repeat") note = h("span.note", "↑ already followed above");
  else if (node.mark === "truncated") note = h("span.note", "… deeper");

  const row = h(
    `li.cascade-row.kind-${kind}${node.mark ? ".mark-" + node.mark : ""}`,
    h(
      "div.cascade-line",
      node.via ? h(`span.verb${cooling ? ".cooling" : ""}`, verb(node.via)) : null,
      nodeRef(app, n, [
        kind === "exposure" ? chip(e, { compact: true }) : h("span.pill-mark", human(e?.treatment_category)),
        h("span.node-title", title(ix, n)),
      ]),
      shared.length
        ? h(
            "span.shared",
            { title: "Also in the direct landscape of: " + shared.map((id) => ix.actions.get(id)?.title).join(", ") },
            shared.map((id) => letter(ctx.letters.get(id))),
          )
        : null,
      note,
    ),
    node.children.length ? h("ul.cascade", node.children.map((c) => cascadeRows(app, c, ctx))) : null,
  );
  return row;
}

function refList(app, items) {
  const { ix } = app.state;
  return h("span.ref-list", items.map((id, i) => {
    const e = ix.exposures.get(id);
    return [i ? h("span.sep", "·") : null, nodeRef(app, nid("exposure", id), e ? [chip(e, { compact: true }), e.risk_title] : id)];
  }));
}

function landscapeFacts(app, landscape, reading) {
  const { ix } = app.state;
  const highest = landscape.highest_exposure ? ix.exposures.get(landscape.highest_exposure.exposure_id) : null;
  const facts = [
    ["Reaches", `${landscape.downstream_reachable_risks} exposure${landscape.downstream_reachable_risks === 1 ? "" : "s"}`],
    ["Immediate", String(landscape.immediate_resulting_risks)],
    ["Deepest chain", landscape.depth != null ? `${landscape.depth} steps` : "–"],
  ];
  return h(
    "div.facts",
    h("dl", facts.map(([k, v]) => [h("dt", k), h("dd", v)])),
    reading.returns.length
      ? h("p.fact-line", h("span.kicker", "Acts on this risk"), " ",
          h("span.ref-list", reading.returns.map((r, i) => [
            i ? h("span.sep", "·") : null,
            h("span.verb.cooling", human(r.semantics)),
            r.node_id === nid("action", landscape.action_id) ? null : [" via ", nodeRef(app, r.node_id)],
          ])))
      : null,
    highest ? h("p.fact-line", h("span.kicker", "Highest L × I"), " ", nodeRef(app, nid("exposure", highest.id), [chip(highest, { compact: true }), " ", highest.risk_title])) : null,
    landscape.high_impact_low_likelihood.length
      ? h("p.fact-line", h("span.kicker", "Severe even if unlikely"), " ",
          refList(app, landscape.high_impact_low_likelihood.map((x) => x.exposure_id)))
      : null,
    landscape.low_confidence.length
      ? h("p.fact-line", h("span.kicker", "Weakly evidenced"), " ",
          refList(app, landscape.low_confidence.map((x) => x.exposure_id)))
      : null,
    landscape.cycles_entered.length
      ? h("p.fact-line", h("span.kicker", "Cycles entered"), ` ${landscape.cycles_entered.length}`)
      : null,
  );
}

export function alternativesView(app) {
  const { ix, decisionExposure, compare, readings, taxonomy } = app.state;
  const points = decisionPoints(ix);
  const others = [...ix.exposures.values()].filter((e) => !points.includes(e));

  if (!ix.exposures.size) {
    return empty(
      "This decision has no risks yet. Start with the risk you are deciding how to respond to.",
      h("button.btn", { type: "button", onclick: () => app.dialogs.addExposure({ focal: true }) }, "Add the focal risk"),
    );
  }

  const root = decisionExposure ? ix.exposures.get(decisionExposure) : null;
  const picker = h(
    "div.decision-picker",
    h("label", { for: "decision-select" }, h("span.kicker", "Deciding on")),
    h(
      "select#decision-select",
      { onchange: (ev) => app.setDecision(ev.target.value) },
      h("optgroup", { label: "Risks with responses" }, points.map((e) => h("option", { value: e.id, selected: e.id === decisionExposure }, e.risk_title + (e.contextual_description ? "" : "")))),
      others.length
        ? h("optgroup", { label: "No responses yet" }, others.map((e) => h("option", { value: e.id, selected: e.id === decisionExposure }, e.risk_title)))
        : null,
    ),
  );

  if (!root) return h("div.alternatives", picker);

  const rootNid = nid("exposure", root.id);
  const alternatives = responsesOf(ix, root.id);
  const letters = new Map(alternatives.map((a, i) => [a.id, i]));
  const shared = app.state.shared;

  const rootCard = h(
    "section.root-card",
    h("div.root-main",
      h("span.kicker", "Risk exposure"),
      h("h2", nodeRef(app, rootNid, root.risk_title)),
      root.contextual_description ? h("p", root.contextual_description) : null,
    ),
    h("div.root-assess",
      chip(root),
      h("span.mini", `L${root.likelihood ?? "–"} · I${root.impact?.overall ?? "–"} · P${root.proximity ?? "–"} · V${root.velocity ?? "–"} · C${root.confidence ?? "–"}`),
    ),
  );

  const columns = alternatives.map((action, i) => {
    const landscape = (compare || []).find((l) => l.action_id === action.id);
    const reading = readings.get(action.id);
    const actionNid = nid("action", action.id);
    return h(
      `article.alt.status-${action.decision_status}`,
      { "aria-labelledby": `alt-${action.id}` },
      h(
        "header.alt-head",
        letter(i),
        h("div.alt-title",
          h("span.kicker", human(action.treatment_category)),
          h("h3", { id: `alt-${action.id}` }, nodeRef(app, actionNid, action.title)),
        ),
      ),
      h(
        "div.alt-status",
        field(
          "Decision status",
          select(taxonomy.action_statuses.map((st) => [st, human(st)]), action.decision_status, (v) => app.patchAction(action.id, { decision_status: v })),
        ),
      ),
      action.rationale ? h("p.rationale", action.rationale) : null,
      landscape && reading ? landscapeFacts(app, landscape, reading) : h("p.muted", "Loading landscape…"),
      reading
        ? h(
            "div.cascade-wrap",
            h("h4", "What it sets in motion"),
            reading.tree.children.length
              ? h("ul.cascade.top", reading.tree.children.map((c) => cascadeRows(app, c, { root: rootNid, shared, letters, actionId: action.id })))
              : h("p.muted", "No consequences recorded yet. That is a gap in the map, not evidence of safety."),
          )
        : null,
      h("footer.alt-foot",
        h("button.btn.small", { type: "button", onclick: () => app.dialogs.resultingRisk(action.id) }, "+ Resulting risk"),
      ),
    );
  });

  return h(
    "div.alternatives",
    picker,
    rootCard,
    alternatives.length
      ? h("div.alt-grid", { style: { "--cols": String(Math.min(alternatives.length, 4)) } }, columns)
      : empty("No responses recorded for this risk yet."),
    h(
      "div.alt-after",
      h("button.btn", { type: "button", onclick: () => app.dialogs.alternative(root.id) }, "+ Add an alternative"),
      compare?.[0]?.caveat ? h("p.caveat", compare[0].caveat) : null,
      h("p.caveat", "Letters beside a risk mark the other alternatives that also lead to it. Reach stops at the risk being decided: an effect on it is shown, not followed onward."),
    ),
  );
}

// ---------------------------------------------------------------- map

const LENS_KEYS = { exposure: "1", impact: "2", urgency: "3", uncertainty: "4", connectivity: "5", decision: "6" };

function legend(lens) {
  const rows = {
    exposure: [h("span.legend-scale", BANDS.map((b) => h(`span.sw.band-${b}`, { title: b }))), "L × I band, low → extreme. The number is the score."],
    impact: [h("span.legend-scale", BANDS.map((b) => h(`span.sw.band-${b}`))), "Fill and border weight follow impact alone."],
    urgency: [h("span.legend-glyph", "◫"), "Inner ring: proximity (how soon). Outer ring: velocity (how fast)."],
    uncertainty: [h("span.legend-glyph.hatch-sw"), "Hatched and dashed: confidence is low. Not the same as likely."],
    connectivity: [h("span.legend-glyph", "⊕ ↺ ◆"), "Convergence · cycle member · on many paths. Border weight: betweenness."],
    decision: [h("span.legend-glyph", "▮ ▯"), "Bright: the risk answered and the landscape this action opens. Faint: not this branch."],
  }[lens];
  return h("p.legend", rows);
}

export function mapView(app) {
  const { ix, lay, lens, decisionAction, taxonomy } = app.state;
  const actions = [...ix.actions.values()];
  const toolbar = h(
    "div.map-toolbar",
    h(
      "div.lenses",
      { role: "radiogroup", "aria-label": "Lens" },
      LENSES.map((l) => {
        const meta = taxonomy.lenses.find((x) => x.id === l);
        return h(
          "button.lens",
          { type: "button", role: "radio", "aria-checked": lens === l ? "true" : "false", title: meta?.short, onclick: () => app.setLens(l) },
          h("kbd", LENS_KEYS[l]),
          meta?.title || l,
        );
      }),
    ),
    lens === "decision"
      ? field(
          "Follow",
          select([["", "choose an action…"], ...actions.map((a) => [a.id, a.title])], decisionAction || "", (v) => app.setDecisionAction(v || null)),
        )
      : null,
    h("div.zoom",
      h("button.icon-btn", { type: "button", "aria-label": "Zoom out", onclick: () => app.setZoom(app.state.zoom / 1.2) }, "−"),
      h("span.zoom-level", `${Math.round(app.state.zoom * 100)}%`),
      h("button.icon-btn", { type: "button", "aria-label": "Zoom in", onclick: () => app.setZoom(app.state.zoom * 1.2) }, "+"),
      h("button.btn.ghost.small", { type: "button", onclick: () => app.fitMap() }, "Fit"),
    ),
  );
  const meta = taxonomy.lenses.find((x) => x.id === lens);
  const canvas = h("div.map-canvas#map-canvas");
  if (ix.nodes.length) {
    canvas.append(
      renderMap(ix, lay, {
        lens,
        taxonomy,
        zoom: app.state.zoom,
        selected: app.state.selected,
        decision: app.state.decisionReach,
        onSelect: (n) => app.select(n),
      }),
    );
  } else canvas.append(empty("Nothing to draw yet."));
  return h(
    "div.map-view",
    toolbar,
    h("div.lens-caption", meta ? h("strong", meta.title + ". ") : null, meta?.short || "", legend(lens)),
    canvas,
    textualGraph(ix),
  );
}

// ---------------------------------------------------------------- register

export function registerView(app) {
  const { ix, sort } = app.state;
  const rows = sortedExposures(ix, sort);
  const shift = rankShift(ix, "score", sort);
  const meta = SORTS[sort];
  return h(
    "div.register",
    h(
      "div.register-head",
      h("div.sorts", { role: "radiogroup", "aria-label": "Order by" },
        Object.entries(SORTS).map(([k, v]) =>
          h("button.lens", { type: "button", role: "radio", "aria-checked": sort === k ? "true" : "false", onclick: () => app.setSort(k) }, v.label),
        ),
      ),
      h("p.question", meta.question, sort !== "score" ? " The arrows show how far each risk moved from the L × I order." : ""),
    ),
    h(
      "div.table-wrap",
      h(
        "table",
        h("thead", h("tr", ["#", "", "Exposure", "L × I", "L", "I", "P", "V", "C", "Reach", "Signals"].map((c) => h("th", { scope: "col" }, c)))),
        h(
          "tbody",
          rows.map((e, i) => {
            const n = nid("exposure", e.id);
            const m = ix.metrics[n] || {};
            const moved = shift.get(e.id) || 0;
            const signals = (ix.insightsByNode.get(n) || []).map((x) => x.title);
            return h(
              "tr",
              { class: app.state.selected === n ? "selected" : "", onclick: () => app.select(n) },
              h("td.num", i + 1),
              h("td.shift", sort === "score" || !moved ? "" : moved > 0 ? h("span.up", { title: `${moved} places higher than under L × I` }, `▲${moved}`) : h("span.down", { title: `${-moved} places lower than under L × I` }, `▼${-moved}`)),
              h("td.title-cell", nodeRef(app, n, e.risk_title), e.contextual_description ? h("span.context", e.contextual_description) : null),
              h("td", chip(e)),
              ...[e.likelihood, e.impact?.overall, e.proximity, e.velocity, e.confidence].map((v) => h("td.num", v ?? "–")),
              h("td.num", m.downstream_risk_count ?? 0),
              h("td.signals", signals.length ? [...new Set(signals)].join(" · ") : ""),
            );
          }),
        ),
      ),
    ),
    h("p.caveat", "Ordinal 1–5 scales. Every column is a different question; no column is the answer."),
  );
}

// ---------------------------------------------------------------- structure

export function insightsView(app) {
  const { ix } = app.state;
  const a = ix.analysis;
  const groups = new Map();
  for (const insight of a.insights) {
    if (!groups.has(insight.kind)) groups.set(insight.kind, []);
    groups.get(insight.kind).push(insight);
  }
  const kindTitle = { structure: "Structure", assessment: "Assessment", reuse: "Reuse" };
  return h(
    "div.structure",
    h(
      "section.card",
      h("h2", "What the shape says"),
      h("p.muted", "Findings the API derives from the graph's structure — the part a spreadsheet hides."),
      [...groups.entries()].map(([kind, list]) =>
        h(
          "div.insight-group",
          h("h3", kindTitle[kind] || human(kind)),
          h(
            "ul.insights",
            list.map((x) =>
              h("li",
                h("strong", x.title),
                x.node_id ? [" — ", nodeRef(app, x.node_id)] : null,
                h("p", x.statement),
                x.explanation ? h("p.muted", x.explanation) : null,
              ),
            ),
          ),
        ),
      ),
    ),
    a.repeated_canonical_risks.length
      ? h(
          "section.card",
          h("h2", "One risk, several contexts"),
          h("p.muted", "The same canonical Risk recorded as separate exposures, each with its own assessment. Different from convergence, where several branches reach one exposure."),
          a.repeated_canonical_risks.map((occ) =>
            h("div.occurrence",
              h("h3", occ.risk_title),
              h("div.occ-grid", occ.exposures.map((x) => {
                const e = ix.exposures.get(x.id);
                return h("div.occ", e ? radar(e, { size: 180 }) : null, nodeRef(app, nid("exposure", x.id), e ? [chip(e), " ", e.contextual_description || e.risk_title] : x.id));
              })),
            ),
          ),
        )
      : null,
    a.convergence_points.length
      ? h("section.card", h("h2", "Convergence"), h("p.muted", "Exposures reached by more than one path."),
          h("ul.plain", a.convergence_points.map((n) => h("li", nodeRef(app, n), ` — ${ix.metrics[n]?.incoming_action_paths ?? 0} action paths in`))))
      : null,
    a.cycles.length
      ? h("section.card", h("h2", "Cycles"), h("ul.plain", a.cycles.map((c) => h("li", c.node_ids.map((n, i) => [i ? " → " : "", nodeRef(app, n)]), " → ↺"))))
      : null,
    h("section.card", h("h2", "Methodology"), h("ul.plain.caveats", ix.caveats.map((c) => h("li", c)))),
  );
}

// ---------------------------------------------------------------- inspector

function scaleRow(app, exposure, scale, value, onPick) {
  const { config } = app.state;
  const def = config[scale];
  return h(
    "div.scale",
    h("div.scale-head", h("span.scale-name", { title: def.teach }, def.title), h("span.scale-level", value ? `${value} · ${levelName(config, scale, value)}` : "not assessed")),
    h(
      "div.scale-steps",
      { role: "radiogroup", "aria-label": def.title },
      def.levels.map((level) =>
        h(
          "button.step",
          {
            type: "button",
            role: "radio",
            "aria-checked": value === level.value ? "true" : "false",
            title: `${level.name}: ${level.definition}`,
            onclick: () => onPick(value === level.value ? null : level.value),
          },
          level.value,
        ),
      ),
    ),
  );
}

function connections(app, n) {
  const { ix } = app.state;
  const outs = ix.out.get(n) || [];
  const ins = (ix.inc.get(n) || []).filter((e) => !e.reversed);
  const row = (e, other, dir) =>
    h("li", dir === "in" ? [nodeRef(app, other), h("span.verb", verb(e.rel)), h("span.muted", "this")] : [h("span.muted", "this"), h("span.verb", verb(e.rel)), nodeRef(app, other)],
      h("button.link-btn", { type: "button", title: "Remove this relationship", "aria-label": "Remove relationship", onclick: () => app.deleteRelationship(e.id) }, "×"));
  return h(
    "section.insp-section",
    h("h3", "Connections"),
    ins.length || outs.length
      ? h("ul.connections", ins.map((e) => row(e, e.source, "in")), outs.map((e) => row(e, e.target, "out")))
      : h("p.muted", "Unconnected."),
  );
}

function exposureInspector(app, n, e) {
  const { ix, config, occurrences } = app.state;
  const m = ix.metrics[n] || {};
  const patch = (body) => app.patchExposure(e.id, body);
  const occ = occurrences.get(e.risk_id);
  const scales = ["likelihood", "impact", "proximity", "velocity", "confidence", ...(config.persistence_enabled ? ["persistence"] : [])];
  const dims = config.impact_dimensions.filter((d) => d.enabled);
  return [
    h("header.insp-head",
      h("span.kicker", "Risk exposure"),
      h("h2", e.risk_title),
      h("p.muted", "Canonical risk: ", ix.risks.get(e.risk_id)?.category ? `${ix.risks.get(e.risk_id).category} · ` : "", ix.risks.get(e.risk_id)?.description || "—"),
    ),
    h("section.insp-section",
      field("In this decision", h("textarea", { rows: 3, onchange: (ev) => patch({ contextual_description: ev.target.value }) }, e.contextual_description)),
    ),
    h("section.insp-section.assess",
      h("div.assess-top", chip(e), radar(e, { size: 210 })),
      scales.map((sc) => {
        const value = sc === "impact" ? e.impact?.overall : e[sc];
        return scaleRow(app, e, sc, value, (v) =>
          sc === "impact" ? patch({ impact: { ...e.impact, overall: v, overall_source: "user" } }) : patch({ [sc]: v }),
        );
      }),
      e.impact?.overall_source === "derived_max" ? h("p.field-hint", "Overall impact is derived: the worst dimension, never an average.") : null,
      h("details.dims",
        { open: app.state.dimsOpen, ontoggle: (ev) => (app.state.dimsOpen = ev.target.open) },
        h("summary", "Impact by dimension"),
        h("div.dim-grid", dims.map((d) =>
          field(d.label, select([["", "–"], ...[1, 2, 3, 4, 5].map((v) => [String(v), `${v} · ${levelName(config, "impact", v)}`])], String(e.impact?.dimensions?.[d.id] ?? ""), (v) => {
            const dimensions = { ...(e.impact?.dimensions || {}) };
            if (v) dimensions[d.id] = Number(v);
            else delete dimensions[d.id];
            patch({ impact: { dimensions, overall: null, overall_source: "derived_max" } });
          }), d.definition),
        )),
      ),
    ),
    h("section.insp-section.two",
      field("Owner", h("input", { value: e.owner, onchange: (ev) => patch({ owner: ev.target.value }) })),
      field("Status", select(app.state.taxonomy.exposure_statuses.map((s) => [s, human(s)]), e.status, (v) => patch({ status: v }))),
    ),
    h("section.insp-section",
      field("Assumptions", h("textarea", { rows: 2, onchange: (ev) => patch({ assumptions: ev.target.value }) }, e.assumptions)),
      field("Evidence", h("textarea", { rows: 2, onchange: (ev) => patch({ evidence: ev.target.value }) }, e.evidence)),
    ),
    h("section.insp-section",
      h("h3", "Structure"),
      h("dl.metrics",
        h("dt", "Downstream risks"), h("dd", m.downstream_risk_count ?? 0),
        h("dt", "Upstream risks"), h("dd", m.upstream_risk_count ?? 0),
        h("dt", "Paths in from actions"), h("dd", m.incoming_action_paths ?? 0),
        h("dt", "Steps from focal"), h("dd", m.depth_from_focal ?? "–"),
      ),
      (ix.insightsByNode.get(n) || []).map((x) => h("p.signal", h("strong", x.title), " — ", x.statement)),
    ),
    h("section.insp-section",
      h("h3", "This risk elsewhere"),
      !occ ? h("p.muted", "Loading…")
        : occ.occurrences.length <= 1 ? h("p.muted", "Only here.")
        : h("ul.plain", occ.occurrences.filter((o) => o.exposure.id !== e.id).map((o) =>
            h("li", chip(o.exposure, { compact: true }), " ",
              o.graph?.id === ix.graph.id ? nodeRef(app, nid("exposure", o.exposure.id), o.exposure.contextual_description || "another exposure in this decision")
                : h("a", { href: `#/g/${encodeURIComponent(o.graph?.id)}` }, o.graph?.title || "another decision"),
            ))),
    ),
    connections(app, n),
    h("footer.insp-foot",
      h("button.btn.small", { type: "button", onclick: () => app.dialogs.alternative(e.id) }, "+ Respond with an action"),
      h("button.btn.small.ghost", { type: "button", onclick: () => app.setDecision(e.id, { go: true }) }, "Compare its responses"),
      h("button.btn.small.danger", { type: "button", onclick: () => app.deleteExposure(e.id) }, "Delete"),
    ),
  ];
}

function actionInspector(app, n, a) {
  const { taxonomy } = app.state;
  const patch = (body) => app.patchAction(a.id, body);
  return [
    h("header.insp-head",
      h("span.kicker", "Action"),
      h("h2", h("input.title-input", { value: a.title, "aria-label": "Action title", onchange: (ev) => patch({ title: ev.target.value }) })),
    ),
    h("section.insp-section.two",
      field("Treatment", select(taxonomy.treatment_categories.map((c) => [c, human(c)]), a.treatment_category, (v) => patch({ treatment_category: v }))),
      field("Decision status", select(taxonomy.action_statuses.map((c) => [c, human(c)]), a.decision_status, (v) => patch({ decision_status: v }))),
    ),
    h("section.insp-section",
      field("Description", h("textarea", { rows: 2, onchange: (ev) => patch({ description: ev.target.value }) }, a.description)),
      field("Rationale", h("textarea", { rows: 2, onchange: (ev) => patch({ rationale: ev.target.value }) }, a.rationale)),
      field("Cost / effort", h("input", { value: a.cost_effort, onchange: (ev) => patch({ cost_effort: ev.target.value }) })),
      field("Assumptions", h("textarea", { rows: 2, onchange: (ev) => patch({ assumptions: ev.target.value }) }, a.assumptions)),
    ),
    h("p.caveat", "A counter-risk is part of the landscape this action creates — not a verdict that the action is wrong."),
    connections(app, n),
    h("footer.insp-foot",
      h("button.btn.small", { type: "button", onclick: () => app.dialogs.resultingRisk(a.id) }, "+ Resulting risk"),
      h("button.btn.small.ghost", { type: "button", onclick: () => app.followOnMap(a.id) }, "Follow on map"),
      h("button.btn.small.danger", { type: "button", onclick: () => app.deleteAction(a.id) }, "Delete"),
    ),
  ];
}

export function inspectorView(app) {
  const { ix, selected } = app.state;
  const e = selected && ix ? entity(ix, selected) : null;
  if (!e) return null;
  const kind = splitNid(selected).kind;
  return h(
    "div.insp",
    h("button.icon-btn.insp-close", { type: "button", "aria-label": "Close inspector (Esc)", onclick: () => app.select(null) }, "×"),
    kind === "exposure" ? exposureInspector(app, selected, e) : actionInspector(app, selected, e),
  );
}

// ---------------------------------------------------------------- dialogs

function formDialog(app, heading, body, onSubmit, submitLabel = "Save") {
  const error = h("p.form-error", { role: "alert" });
  const form = h(
    "form.dialog-form",
    { method: "dialog" },
    h("h2", heading),
    body,
    error,
    h("div.dialog-actions",
      h("button.btn.ghost", { type: "button", onclick: () => app.closeDialog() }, "Cancel"),
      h("button.btn", { type: "submit" }, submitLabel),
    ),
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    error.textContent = "";
    try {
      await onSubmit(new FormData(form), form);
      app.closeDialog();
    } catch (err) {
      error.textContent = err.message;
    }
  });
  return form;
}

const levelOptions = (app, scale) => [["", "not yet"], ...app.state.config[scale].levels.map((l) => [String(l.value), `${l.value} · ${l.name}`])];
const num = (v) => (v === "" || v == null ? null : Number(v));

export function newGraphForm(app) {
  return formDialog(app, "New decision",
    [
      field("Title", h("input", { name: "title", required: true, placeholder: "e.g. Platform migration" })),
      field("Objective", h("input", { name: "objective", placeholder: "What must the decision protect or achieve?" })),
      field("Context", h("textarea", { name: "description", rows: 3 })),
    ],
    async (fd) => {
      const g = await app.api.createGraph({ title: fd.get("title"), objective: fd.get("objective"), description: fd.get("description") });
      location.hash = `#/g/${encodeURIComponent(g.id)}`;
    },
    "Create",
  );
}

export function editGraphForm(app) {
  const g = app.state.ix.graph;
  return formDialog(app, "Edit decision",
    [
      field("Title", h("input", { name: "title", required: true, value: g.title })),
      field("Objective", h("input", { name: "objective", value: g.objective })),
      field("Context", h("textarea", { name: "description", rows: 3 }, g.description)),
      h("details.danger-zone", h("summary", "Delete this decision"),
        h("button.btn.small.danger", { type: "button", onclick: () => app.deleteGraph() }, "Delete permanently")),
    ],
    async (fd) => {
      await app.api.patchGraph(g.id, { title: fd.get("title"), objective: fd.get("objective"), description: fd.get("description") });
      await app.refresh();
    },
  );
}

export function addExposureForm(app, risks, { focal = false } = {}) {
  const modeNew = h("input", { type: "radio", name: "mode", value: "new", checked: true });
  const modeExisting = h("input", { type: "radio", name: "mode", value: "existing", disabled: !risks.length });
  return formDialog(app, "Add a risk exposure",
    [
      h("fieldset.modes",
        h("legend", "Which risk?"),
        h("label.mode", modeNew, h("span", h("strong", "A new risk"), h("span.field-hint", "A concept not yet in the library."))),
        h("label.mode", modeExisting, h("span", h("strong", "A risk already in the library"), h("span.field-hint", "Reuse the concept; this decision gets its own assessment."))),
      ),
      field("New risk title", h("input", { name: "title", placeholder: "e.g. Loss of engineering capacity" })),
      field("Existing risk", select([["", "choose…"], ...risks.map((r) => [r.id, r.title])], "", () => {}, { name: "risk_id" })),
      field("In this decision", h("textarea", { name: "context", rows: 2, placeholder: "How this risk shows up here." })),
      h("div.two", field("Likelihood", select(levelOptions(app, "likelihood"), "", () => {}, { name: "likelihood" })), field("Impact", select(levelOptions(app, "impact"), "", () => {}, { name: "impact" }))),
      h("label.check", h("input", { type: "checkbox", name: "focal", checked: focal }), " This is the risk the decision is about (focal)"),
    ],
    async (fd) => {
      const body = {
        contextual_description: fd.get("context") || "",
        likelihood: num(fd.get("likelihood")),
        impact: { overall: num(fd.get("impact")) },
        as_focal: fd.get("focal") === "on",
      };
      if (fd.get("mode") === "existing") {
        if (!fd.get("risk_id")) throw new Error("Choose an existing risk.");
        body.risk_id = fd.get("risk_id");
      } else {
        if (!fd.get("title")) throw new Error("Give the new risk a title.");
        body.new_risk = { title: fd.get("title") };
      }
      const exp = await app.api.createExposure(app.state.ix.graph.id, body);
      await app.refresh();
      app.select(nid("exposure", exp.id));
    },
    "Add",
  );
}

export function alternativeForm(app, exposureId) {
  const { ix, taxonomy } = app.state;
  const e = ix.exposures.get(exposureId);
  return formDialog(app, "Add an alternative",
    [
      h("p.muted", "A possible response to ", h("strong", e?.risk_title), ". Record it even if it may be rejected: its landscape is part of the decision."),
      field("Action", h("input", { name: "title", required: true, placeholder: "e.g. Add a second supplier" })),
      field("Treatment", select(taxonomy.treatment_categories.map((c) => [c, human(c)]), "mitigate", () => {}, { name: "treatment_category" })),
      field("Rationale", h("textarea", { name: "rationale", rows: 2 })),
    ],
    async (fd) => {
      const a = await app.api.createAction(ix.graph.id, {
        title: fd.get("title"),
        treatment_category: fd.get("treatment_category"),
        rationale: fd.get("rationale") || "",
        in_response_to: exposureId,
      });
      await app.refresh();
      app.select(nid("action", a.id));
    },
    "Add",
  );
}

export function resultingRiskForm(app, actionId, risks) {
  const { ix, taxonomy } = app.state;
  const action = ix.actions.get(actionId);
  const verbs = Object.entries(taxonomy.relationship_semantics).filter(
    ([, v]) => v.from_kinds.includes("action") && v.to_kinds.includes("exposure") && v.family !== "custom",
  );
  const mode = (value, label, hint, checked = false) =>
    h("label.mode", h("input", { type: "radio", name: "mode", value, checked }), h("span", h("strong", label), h("span.field-hint", hint)));
  return formDialog(app, "What does this action change?",
    [
      h("p.muted", h("strong", action?.title), " …"),
      field("Effect", select(verbs.map(([k, v]) => [k, v.label]), "creates", () => {}, { name: "semantics" }), "The precise verb matters: “exposes” and “increases” are not “creates”."),
      h("fieldset.modes",
        h("legend", "Which risk?"),
        mode("new_risk", "A new risk", "Not yet in the library.", true),
        mode("existing_risk_new_exposure", "A known risk, in a new context", "Same canonical Risk, separate exposure with its own assessment."),
        mode("existing_exposure", "An exposure already on this map", "Convergence: this branch reaches the same exposure another path reaches."),
      ),
      field("New risk title", h("input", { name: "title" })),
      field("Known risk", select([["", "choose…"], ...risks.map((r) => [r.id, r.title])], "", () => {}, { name: "risk_id" })),
      field("Exposure on this map", select([["", "choose…"], ...[...ix.exposures.values()].map((e) => [e.id, `${e.risk_title}${e.contextual_description ? " — " + e.contextual_description.slice(0, 50) : ""}`])], "", () => {}, { name: "exposure_id" })),
      field("In this context", h("textarea", { name: "context", rows: 2 })),
      h("div.two", field("Likelihood", select(levelOptions(app, "likelihood"), "", () => {}, { name: "likelihood" })), field("Impact", select(levelOptions(app, "impact"), "", () => {}, { name: "impact" }))),
    ],
    async (fd) => {
      const m = fd.get("mode");
      const body = { action_id: actionId, semantics: fd.get("semantics"), mode: m, contextual_description: fd.get("context") || "" };
      const assess = { likelihood: num(fd.get("likelihood")) };
      if (num(fd.get("impact"))) assess.impact = { overall: num(fd.get("impact")) };
      if (m === "new_risk") {
        if (!fd.get("title")) throw new Error("Give the new risk a title.");
        body.new_risk = { title: fd.get("title") };
        body.exposure = assess;
      } else if (m === "existing_risk_new_exposure") {
        if (!fd.get("risk_id")) throw new Error("Choose the known risk.");
        body.existing_risk_id = fd.get("risk_id");
        body.exposure = assess;
      } else {
        if (!fd.get("exposure_id")) throw new Error("Choose the exposure this branch converges on.");
        body.existing_exposure_id = fd.get("exposure_id");
      }
      await app.api.resultingRisk(ix.graph.id, body);
      await app.refresh();
    },
    "Add to the landscape",
  );
}

export function glossaryDialog(app) {
  const { taxonomy } = app.state;
  return h(
    "div.dialog-form.glossary",
    h("h2", "Glossary"),
    h("dl", taxonomy.glossary.map((g) => [h("dt", g.term), h("dd", g.short, g.distinction ? h("span.field-hint", g.distinction) : null)])),
    h("h3", "Keys"),
    h("p.muted", "/ search · ? glossary · 1–6 lenses on the map · Esc closes"),
    h("div.dialog-actions", h("button.btn", { type: "button", onclick: () => app.closeDialog() }, "Close")),
  );
}

export function occurrencesDialog(app, occ) {
  return h(
    "div.dialog-form",
    h("span.kicker", "Canonical risk"),
    h("h2", occ.risk.title),
    occ.risk.description ? h("p", occ.risk.description) : null,
    h("ul.plain", occ.occurrences.map((o) =>
      h("li", chip(o.exposure, { compact: true }), " ",
        h("a", { href: `#/g/${encodeURIComponent(o.graph?.id)}`, onclick: () => app.closeDialog() }, o.graph?.title || "unknown decision"),
        o.exposure.contextual_description ? h("span.field-hint", o.exposure.contextual_description) : null),
    )),
    h("div.dialog-actions", h("button.btn", { type: "button", onclick: () => app.closeDialog() }, "Close")),
  );
}
