import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { layout } from "./layout.js";
import { LENSES, nodeSize } from "./map.js";
import { cascade, decisionPoints, directReach, indexBundle, nid, readLandscape, sharedIndex, splitNid, title } from "./model.js";
import * as V from "./views.js";

const $ = (sel) => document.querySelector(sel);
const store = {
  get(key, fallback) {
    try {
      return localStorage.getItem("ledger." + key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("ledger." + key, value);
    } catch {
      /* private mode: preferences simply do not persist */
    }
  },
};

const state = {
  taxonomy: null,
  config: null,
  health: null,
  graphs: [],
  graphId: null,
  tab: "alternatives",
  ix: null,
  lay: null,
  decisionExposure: null,
  compare: null,
  readings: new Map(),
  shared: new Map(),
  lens: LENSES.includes(store.get("lens")) ? store.get("lens") : "exposure",
  decisionAction: null,
  decisionReach: null,
  zoom: 1,
  fitted: false,
  dimsOpen: false,
  sort: "score",
  selected: null,
  occurrences: new Map(),
  error: null,
};

// ------------------------------------------------------------------ rendering

function crumbs() {
  const nav = $("#crumbs");
  mount(nav, state.ix && state.graphId ? [h("a", { href: "#/" }, "Decisions"), h("span.sep", "/"), h("span", state.ix.graph.title)] : null);
}

function render() {
  const main = $("#main");
  const canvas = $("#map-canvas");
  const scroll = canvas ? [canvas.scrollLeft, canvas.scrollTop] : null;
  const focused = document.activeElement?.closest?.("[data-node]")?.dataset.node;

  crumbs();
  if (state.error) {
    mount(main, h("div.empty.error", h("h2", "The API did not answer"), h("p", state.error), h("p.muted", "Start it with: cd backend && uvicorn app.main:app --port 8000"), h("button.btn", { type: "button", onclick: () => boot() }, "Try again")));
    return;
  }
  if (!state.taxonomy) {
    mount(main, h("p.loading", "Loading…"));
    return;
  }
  if (!state.graphId) {
    mount(main, V.homeView(app));
  } else if (state.ix) {
    const body = {
      alternatives: V.alternativesView,
      map: V.mapView,
      register: V.registerView,
      insights: V.insightsView,
    }[state.tab] || V.alternativesView;
    mount(main, V.graphHeader(app), h(`div.tab-body.tab-${state.tab}`, body(app)));
  } else {
    mount(main, h("p.loading", "Loading decision…"));
  }

  const next = $("#map-canvas");
  if (next && scroll) [next.scrollLeft, next.scrollTop] = scroll;
  if (focused) document.querySelector(`[data-node="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  renderInspector();
}

function renderInspector() {
  const aside = $("#inspector");
  const view = V.inspectorView(app);
  document.body.classList.toggle("has-inspector", Boolean(view));
  aside.hidden = !view;
  if (view) mount(aside, view);
}

function toast(text, kind = "") {
  const el = $("#toast");
  el.textContent = text;
  el.className = `toast show ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.className = "toast"), 3200);
}

// ------------------------------------------------------------------ data

async function loadGraph(id) {
  const bundle = await api.bundle(id);
  state.ix = indexBundle(bundle);
  state.lay = layout(state.ix.nodes, state.ix.edges, {
    roots: (bundle.graph.focal_exposure_ids || []).map((x) => nid("exposure", x)),
    size: nodeSize,
  });
  if (state.selected && !state.ix.nodes.includes(state.selected)) state.selected = null;
  const points = decisionPoints(state.ix);
  if (!state.decisionExposure || !state.ix.exposures.has(state.decisionExposure)) {
    state.decisionExposure = points[0]?.id || [...state.ix.exposures.keys()][0] || null;
  }
  await Promise.all([loadCompare(), loadDecisionReach()]);
}

async function loadCompare() {
  state.compare = null;
  state.readings = new Map();
  state.shared = new Map();
  if (!state.decisionExposure) return;
  const compare = await api.compareActions(state.graphId, state.decisionExposure);
  state.compare = compare;
  state.readings = new Map(compare.map((l) => [l.action_id, readLandscape(state.ix, l, state.decisionExposure)]));
  state.shared = sharedIndex(state.readings);
}

async function loadDecisionReach() {
  state.decisionReach = null;
  const actionId = state.decisionAction;
  if (!actionId || !state.ix?.actions.has(actionId)) return;
  const start = nid("action", actionId);
  const server = await api.decisionPath(state.graphId, actionId);
  // The direct landscape stops where the branch re-enters the risk it responds to.
  const roots = (state.ix.inc.get(start) || []).filter((e) => e.rel.semantics === "has_response").map((e) => e.source);
  const tree = cascade(state.ix, start, { root: roots[0] || null });
  const direct = directReach(tree);
  roots.forEach((r) => direct.add(r));
  const feedback = new Set(server.node_ids.filter((n) => !direct.has(n)));
  state.decisionReach = { direct, feedback };
}

async function refresh() {
  if (!state.graphId) {
    state.graphs = await api.graphs();
  } else {
    state.occurrences = new Map();
    await loadGraph(state.graphId);
    ensureOccurrences();
  }
  render();
}

function ensureOccurrences() {
  if (!state.selected || !state.selected.startsWith("exposure:")) return;
  const e = state.ix.exposures.get(splitNid(state.selected).id);
  if (!e || state.occurrences.has(e.risk_id)) return;
  state.occurrences.set(e.risk_id, null);
  api.occurrences(e.risk_id).then((occ) => {
    state.occurrences.set(e.risk_id, occ);
    renderInspector();
  }).catch(() => state.occurrences.delete(e.risk_id));
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const graphId = parts[0] === "g" ? parts[1] : null;
  const tab = parts[2] || "alternatives";
  const changed = graphId !== state.graphId;
  state.graphId = graphId;
  state.tab = tab;
  if (changed) {
    state.ix = null;
    state.selected = null;
    state.decisionExposure = null;
    state.decisionAction = null;
    state.zoom = 1;
    state.fitted = false;
  }
  render();
  try {
    if (!graphId) {
      [state.graphs, state.health] = await Promise.all([api.graphs(), api.health().catch(() => null)]);
    } else if (changed) {
      await loadGraph(graphId);
    }
    state.error = null;
  } catch (err) {
    if (graphId && /404/.test(err.message)) {
      toast("That decision no longer exists.");
      location.hash = "#/";
      return;
    }
    state.error = err.message;
  }
  render();
  if (state.tab === "map" && state.ix && !state.fitted) {
    state.fitted = true;
    requestAnimationFrame(fitMap);
  }
  if (changed) $("#main").focus({ preventScroll: true });
}

// ------------------------------------------------------------------ actions

async function guarded(fn, done) {
  try {
    await fn();
    await refresh();
    if (done) toast(done);
  } catch (err) {
    toast(err.message, "error");
  }
}

function fitMap() {
  const canvas = $("#map-canvas");
  if (!canvas || !state.lay) return;
  const pad = 80;
  const fit = Math.min((canvas.clientWidth - 8) / (state.lay.width + pad), (canvas.clientHeight - 8) / (state.lay.height + pad + 80));
  state.zoom = Math.max(0.35, Math.min(1.25, fit));
  render();
}

const dialogEl = () => $("#dialog");

const app = {
  state,
  api,
  refresh,
  select(n) {
    state.selected = n;
    ensureOccurrences();
    render();
    if (n && window.matchMedia("(max-width: 900px)").matches) $("#inspector").scrollIntoView({ behavior: "smooth" });
  },
  async setDecision(exposureId, { go = false } = {}) {
    state.decisionExposure = exposureId;
    if (go && state.tab !== "alternatives") location.hash = `#/g/${encodeURIComponent(state.graphId)}/alternatives`;
    render();
    try {
      await loadCompare();
    } catch (err) {
      toast(err.message, "error");
    }
    render();
  },
  setLens(l) {
    state.lens = l;
    store.set("lens", l);
    if (l === "decision" && !state.decisionAction) {
      const selectedAction = state.selected?.startsWith("action:") ? splitNid(state.selected).id : null;
      const first = state.decisionExposure ? state.readings.keys().next().value : null;
      const pick = selectedAction || first;
      if (pick) return app.setDecisionAction(pick);
    }
    render();
  },
  async setDecisionAction(id) {
    state.decisionAction = id;
    try {
      await loadDecisionReach();
    } catch (err) {
      toast(err.message, "error");
    }
    render();
  },
  followOnMap(actionId) {
    state.lens = "decision";
    location.hash = `#/g/${encodeURIComponent(state.graphId)}/map`;
    app.setDecisionAction(actionId);
  },
  setZoom(z) {
    state.zoom = Math.max(0.3, Math.min(2.5, z));
    render();
  },
  fitMap,
  setSort(k) {
    state.sort = k;
    render();
  },
  patchExposure: (id, body) => guarded(() => api.patchExposure(id, body)),
  patchAction: (id, body) => guarded(() => api.patchAction(id, body)),
  deleteRelationship: (id) => confirm("Remove this relationship?") && guarded(() => api.deleteRelationship(id), "Relationship removed"),
  deleteExposure: (id) => confirm("Delete this exposure and its relationships? The canonical risk stays in the library.") && guarded(async () => {
    await api.deleteExposure(id);
    state.selected = null;
  }, "Exposure deleted"),
  deleteAction: (id) => confirm("Delete this action and its relationships?") && guarded(async () => {
    await api.deleteAction(id);
    state.selected = null;
    if (state.decisionAction === id) state.decisionAction = null;
  }, "Action deleted"),
  async deleteGraph() {
    if (!confirm(`Delete “${state.ix.graph.title}” permanently?`)) return;
    try {
      await api.deleteGraph(state.graphId);
      app.closeDialog();
      location.hash = "#/";
      toast("Decision deleted");
    } catch (err) {
      toast(err.message, "error");
    }
  },
  async reseed() {
    if (!confirm("Reload the demonstration decision? It replaces the demo data.")) return;
    await guarded(() => api.seed(), "Demo reloaded");
  },
  openDialog(content) {
    const d = dialogEl();
    mount(d, content);
    if (!d.open) d.showModal();
    d.querySelector("input:not([type=radio]):not([type=checkbox]), textarea, select, button")?.focus();
  },
  closeDialog() {
    const d = dialogEl();
    if (d.open) d.close();
  },
  dialogs: {
    newGraph: () => app.openDialog(V.newGraphForm(app)),
    editGraph: () => app.openDialog(V.editGraphForm(app)),
    async addExposure(opts) {
      app.openDialog(V.addExposureForm(app, await api.risks(), opts));
    },
    alternative: (exposureId) => app.openDialog(V.alternativeForm(app, exposureId)),
    async resultingRisk(actionId) {
      app.openDialog(V.resultingRiskForm(app, actionId, await api.risks()));
    },
    glossary: () => app.openDialog(V.glossaryDialog(app)),
  },
};

// ------------------------------------------------------------------ search

function setupSearch() {
  const input = $("#search");
  const panel = $("#search-results");
  let seq = 0;
  let timer;
  const close = () => (panel.hidden = true);
  const open = async (hit) => {
    close();
    input.value = "";
    if (hit.kind === "graph") location.hash = `#/g/${encodeURIComponent(hit.id)}`;
    else if (hit.kind === "risk") app.openDialog(V.occurrencesDialog(app, await api.occurrences(hit.id)));
    else if (hit.graph_id) {
      if (hit.graph_id !== state.graphId) {
        location.hash = `#/g/${encodeURIComponent(hit.graph_id)}`;
        await new Promise((r) => setTimeout(r, 0));
        while (!state.ix || state.ix.graph.id !== hit.graph_id) await new Promise((r) => setTimeout(r, 50));
      }
      if (hit.kind === "exposure") app.select(nid("exposure", hit.id));
      if (hit.kind === "action") app.select(nid("action", hit.id));
    }
  };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const text = input.value.trim();
    if (!text) return close();
    timer = setTimeout(async () => {
      const mine = ++seq;
      let hits = [];
      try {
        hits = await api.search(text);
      } catch {
        /* ignore transient errors while typing */
      }
      if (mine !== seq) return;
      mount(panel, hits.length
        ? h("ul", hits.slice(0, 12).map((hit) =>
            h("li", h("button", { type: "button", onclick: () => open(hit) }, h("span.kicker", hit.kind), " ", hit.title, hit.subtitle ? h("span.field-hint", hit.subtitle) : null))))
        : h("p.muted", "No matches."));
      panel.hidden = false;
    }, 160);
  });
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      input.value = "";
      close();
      input.blur();
    }
    if (ev.key === "ArrowDown") panel.querySelector("button")?.focus();
  });
  document.addEventListener("click", (ev) => {
    if (!panel.contains(ev.target) && ev.target !== input) close();
  });
}

// ------------------------------------------------------------------ keys & boot

function setupKeys() {
  document.addEventListener("keydown", (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable;
    if (dialogEl().open) return;
    if (ev.key === "Escape" && state.selected) {
      app.select(null);
      return;
    }
    if (typing || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === "/") {
      ev.preventDefault();
      $("#search").focus();
    } else if (ev.key === "?") app.dialogs.glossary();
    else if (state.tab === "map" && state.ix && /^[1-6]$/.test(ev.key)) app.setLens(LENSES[Number(ev.key) - 1]);
  });
  $("#theme").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("theme", root.dataset.theme);
  });
  $("#glossary-btn").addEventListener("click", () => app.dialogs.glossary());
  dialogEl().addEventListener("click", (ev) => {
    if (ev.target === dialogEl()) app.closeDialog();
  });
}

async function boot() {
  state.error = null;
  render();
  try {
    [state.taxonomy, state.config] = await Promise.all([api.taxonomy(), api.assessmentConfig()]);
  } catch (err) {
    state.error = err.message;
    render();
    return;
  }
  await route();
}

window.addEventListener("hashchange", route);
setupKeys();
setupSearch();
boot();

// Exposed for debugging in the console and for end-to-end checks.
window.ledger = { app, title: (n) => title(state.ix, n) };
