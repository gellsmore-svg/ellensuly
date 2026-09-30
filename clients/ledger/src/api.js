// The Ellensúly HTTP contract, and nothing else. See /api/docs on the server.

const params = new URLSearchParams(location.search);
const BASE = (params.get("api") || "").replace(/\/$/, "") + "/api/v1";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const payload = await res.json();
      detail = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
    } catch {
      /* keep statusText */
    }
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

const q = (obj) => "?" + new URLSearchParams(obj).toString();

export const api = {
  health: () => fetch(BASE.replace(/\/api\/v1$/, "") + "/health").then((r) => r.json()),
  taxonomy: () => call("GET", "/taxonomy"),
  assessmentConfig: () => call("GET", "/config/assessment"),

  graphs: () => call("GET", "/graphs"),
  createGraph: (body) => call("POST", "/graphs", body),
  patchGraph: (id, body) => call("PATCH", `/graphs/${id}`, body),
  deleteGraph: (id) => call("DELETE", `/graphs/${id}`),
  bundle: (id) => call("GET", `/graphs/${id}/bundle`),

  risks: () => call("GET", "/risks"),
  occurrences: (riskId) => call("GET", `/risks/${riskId}/occurrences`),

  createExposure: (graphId, body) => call("POST", `/graphs/${graphId}/exposures`, body),
  patchExposure: (id, body) => call("PATCH", `/exposures/${id}`, body),
  deleteExposure: (id) => call("DELETE", `/exposures/${id}`),

  createAction: (graphId, body) => call("POST", `/graphs/${graphId}/actions`, body),
  patchAction: (id, body) => call("PATCH", `/actions/${id}`, body),
  deleteAction: (id) => call("DELETE", `/actions/${id}`),

  createRelationship: (graphId, body) => call("POST", `/graphs/${graphId}/relationships`, body),
  deleteRelationship: (id) => call("DELETE", `/relationships/${id}`),

  resultingRisk: (graphId, body) => call("POST", `/graphs/${graphId}/workflow/resulting-risk`, body),

  compareActions: (graphId, exposureId) =>
    call("GET", `/graphs/${graphId}/analysis/compare-actions${q({ exposure_id: exposureId })}`),
  decisionPath: (graphId, actionId) =>
    call("GET", `/graphs/${graphId}/analysis/decision-path${q({ action_id: actionId })}`),
  upstream: (graphId, nodeId) => call("GET", `/graphs/${graphId}/analysis/upstream${q({ node_id: nodeId })}`),
  downstream: (graphId, nodeId) => call("GET", `/graphs/${graphId}/analysis/downstream${q({ node_id: nodeId })}`),

  search: (text) => call("GET", `/search${q({ q: text })}`),
  seed: () => call("POST", "/seed?replace=true"),
};
