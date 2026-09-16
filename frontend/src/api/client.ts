import type {
  Action,
  ActionLandscape,
  AssessmentConfig,
  DecisionGraph,
  GraphBundle,
  RegisterRow,
  Relationship,
  Risk,
  RiskExposure,
  SearchHit,
  Taxonomy,
} from "./types";

const base = (import.meta.env.VITE_API_BASE as string | undefined) || "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => req<{ status: string; name: string }>("/health"),
  taxonomy: () => req<Taxonomy>("/api/v1/taxonomy"),
  config: () => req<AssessmentConfig>("/api/v1/config/assessment"),
  graphs: () => req<DecisionGraph[]>("/api/v1/graphs"),
  createGraph: (body: Partial<DecisionGraph> & { title: string }) =>
    req<DecisionGraph>("/api/v1/graphs", { method: "POST", body: JSON.stringify(body) }),
  getGraph: (id: string) => req<DecisionGraph>(`/api/v1/graphs/${id}`),
  patchGraph: (id: string, body: Record<string, unknown>) =>
    req<DecisionGraph>(`/api/v1/graphs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  bundle: (id: string) => req<GraphBundle>(`/api/v1/graphs/${id}/bundle`),
  risks: () => req<Risk[]>("/api/v1/risks"),
  createRisk: (body: Partial<Risk> & { title: string }) =>
    req<Risk>("/api/v1/risks", { method: "POST", body: JSON.stringify(body) }),
  riskOccurrences: (id: string) =>
    req<{ risk: Risk; occurrences: Array<{ exposure: RiskExposure; graph: DecisionGraph | null }> }>(
      `/api/v1/risks/${id}/occurrences`,
    ),
  createExposure: (graphId: string, body: Record<string, unknown>) =>
    req<RiskExposure>(`/api/v1/graphs/${graphId}/exposures`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchExposure: (id: string, body: Record<string, unknown>) =>
    req<RiskExposure>(`/api/v1/exposures/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createAction: (graphId: string, body: Record<string, unknown>) =>
    req<Action>(`/api/v1/graphs/${graphId}/actions`, { method: "POST", body: JSON.stringify(body) }),
  patchAction: (id: string, body: Record<string, unknown>) =>
    req<Action>(`/api/v1/actions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createRelationship: (graphId: string, body: Record<string, unknown>) =>
    req<Relationship>(`/api/v1/graphs/${graphId}/relationships`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  resultingRisk: (graphId: string, body: Record<string, unknown>) =>
    req<{ exposure: RiskExposure; relationship: Relationship }>(
      `/api/v1/graphs/${graphId}/workflow/resulting-risk`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  compare: (graphId: string, exposureId: string) =>
    req<ActionLandscape[]>(
      `/api/v1/graphs/${graphId}/analysis/compare-actions?exposure_id=${encodeURIComponent(exposureId)}`,
    ),
  decisionPath: (graphId: string, actionId: string) =>
    req<{ action_id: string; node_ids: string[] }>(
      `/api/v1/graphs/${graphId}/analysis/decision-path?action_id=${encodeURIComponent(actionId)}`,
    ),
  register: (graphId?: string) =>
    req<RegisterRow[]>(graphId ? `/api/v1/register?graph_id=${graphId}` : "/api/v1/register"),
  search: (q: string) => req<SearchHit[]>(`/api/v1/search?q=${encodeURIComponent(q)}`),
  seed: () => req<Record<string, unknown>>("/api/v1/seed", { method: "POST" }),
};
