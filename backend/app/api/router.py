from fastapi import APIRouter, HTTPException, Query

from app.api.deps import StoreDep
from app.models.assessment import AssessmentConfig
from app.models.entities import (
    ActionCreate,
    ActionUpdate,
    DecisionGraphCreate,
    DecisionGraphUpdate,
    RelationshipCreate,
    RelationshipUpdate,
    ResultingRiskRequest,
    RiskCreate,
    RiskExposureCreate,
    RiskExposureUpdate,
    RiskUpdate,
    exposure_public,
)
from app.seed.supplier_continuity import load_demo
from app.services.workspace import (
    add_resulting_risk,
    analysis_branch,
    analysis_compare,
    analysis_neighbourhood,
    analysis_paths,
    analysis_walk,
    bundle_for,
    maybe_derive_impact,
    resolve_risk,
    search,
    taxonomy_payload,
)

api_router = APIRouter(prefix="/api/v1")


@api_router.get("/taxonomy")
async def taxonomy():
    return taxonomy_payload()


@api_router.get("/config/assessment")
async def get_assessment_config(store: StoreDep):
    return await store.get_config()


@api_router.put("/config/assessment")
async def put_assessment_config(payload: AssessmentConfig, store: StoreDep):
    return await store.save_config(payload)


@api_router.get("/graphs")
async def list_graphs(store: StoreDep):
    return await store.list_graphs()


@api_router.post("/graphs", status_code=201)
async def create_graph(payload: DecisionGraphCreate, store: StoreDep):
    return await store.create_graph(payload)


@api_router.get("/graphs/{graph_id}")
async def get_graph(graph_id: str, store: StoreDep):
    graph = await store.get_graph(graph_id)
    if not graph:
        raise HTTPException(404, "Decision graph not found")
    return graph


@api_router.patch("/graphs/{graph_id}")
async def patch_graph(graph_id: str, payload: DecisionGraphUpdate, store: StoreDep):
    graph = await store.update_graph(graph_id, payload)
    if not graph:
        raise HTTPException(404, "Decision graph not found")
    return graph


@api_router.delete("/graphs/{graph_id}")
async def delete_graph(graph_id: str, store: StoreDep):
    ok = await store.delete_graph(graph_id)
    if not ok:
        raise HTTPException(404, "Decision graph not found")
    return {"deleted": True}


@api_router.get("/graphs/{graph_id}/bundle")
async def get_bundle(graph_id: str, store: StoreDep):
    return await bundle_for(store, graph_id)


@api_router.get("/risks")
async def list_risks(store: StoreDep):
    return await store.list_risks()


@api_router.post("/risks", status_code=201)
async def create_risk(payload: RiskCreate, store: StoreDep):
    return await store.create_risk(payload)


@api_router.get("/risks/{risk_id}")
async def get_risk(risk_id: str, store: StoreDep):
    risk = await store.get_risk(risk_id)
    if not risk:
        raise HTTPException(404, "Risk not found")
    return risk


@api_router.patch("/risks/{risk_id}")
async def patch_risk(risk_id: str, payload: RiskUpdate, store: StoreDep):
    risk = await store.update_risk(risk_id, payload)
    if not risk:
        raise HTTPException(404, "Risk not found")
    return risk


@api_router.delete("/risks/{risk_id}")
async def delete_risk(risk_id: str, store: StoreDep):
    try:
        ok = await store.delete_risk(risk_id)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    if not ok:
        raise HTTPException(404, "Risk not found")
    return {"deleted": True}


@api_router.get("/risks/{risk_id}/occurrences")
async def risk_occurrences(risk_id: str, store: StoreDep):
    risk = await store.get_risk(risk_id)
    if not risk:
        raise HTTPException(404, "Risk not found")
    exposures = await store.list_exposures(risk_id=risk_id)
    graphs = {g.id: g for g in await store.list_graphs()}
    return {
        "risk": risk,
        "occurrences": [
            {
                "exposure": exposure_public(e, risk.title),
                "graph": graphs.get(e.graph_id),
            }
            for e in exposures
        ],
    }


@api_router.get("/graphs/{graph_id}/exposures")
async def list_exposures(graph_id: str, store: StoreDep):
    if not await store.get_graph(graph_id):
        raise HTTPException(404, "Decision graph not found")
    exposures = await store.list_exposures(graph_id)
    titles = {}
    out = []
    for e in exposures:
        if e.risk_id not in titles:
            risk = await store.get_risk(e.risk_id)
            titles[e.risk_id] = risk.title if risk else None
        out.append(exposure_public(e, titles[e.risk_id]))
    return out


@api_router.post("/graphs/{graph_id}/exposures", status_code=201)
async def create_exposure(graph_id: str, payload: RiskExposureCreate, store: StoreDep):
    if not await store.get_graph(graph_id):
        raise HTTPException(404, "Decision graph not found")
    maybe_derive_impact(payload)
    risk = await resolve_risk(store, payload)
    exp = await store.create_exposure(graph_id, payload.model_copy(update={"risk_id": risk.id}), risk)
    return exposure_public(exp, risk.title)


@api_router.get("/exposures/{exposure_id}")
async def get_exposure(exposure_id: str, store: StoreDep):
    exp = await store.get_exposure(exposure_id)
    if not exp:
        raise HTTPException(404, "Exposure not found")
    risk = await store.get_risk(exp.risk_id)
    return exposure_public(exp, risk.title if risk else None)


@api_router.patch("/exposures/{exposure_id}")
async def patch_exposure(exposure_id: str, payload: RiskExposureUpdate, store: StoreDep):
    if payload.impact is not None:
        maybe_derive_impact(RiskExposureCreate(risk_id="x", impact=payload.impact))
        if payload.impact.overall is None and payload.impact.dimensions:
            from app.models.assessment import derived_overall_impact

            derived = derived_overall_impact(payload.impact.dimensions)
            if derived is not None:
                payload.impact.overall = derived
                payload.impact.overall_source = "derived_max"
    exp = await store.update_exposure(exposure_id, payload)
    if not exp:
        raise HTTPException(404, "Exposure not found")
    risk = await store.get_risk(exp.risk_id)
    return exposure_public(exp, risk.title if risk else None)


@api_router.delete("/exposures/{exposure_id}")
async def delete_exposure(exposure_id: str, store: StoreDep):
    ok = await store.delete_exposure(exposure_id)
    if not ok:
        raise HTTPException(404, "Exposure not found")
    return {"deleted": True}


@api_router.get("/graphs/{graph_id}/actions")
async def list_actions(graph_id: str, store: StoreDep):
    if not await store.get_graph(graph_id):
        raise HTTPException(404, "Decision graph not found")
    return await store.list_actions(graph_id)


@api_router.post("/graphs/{graph_id}/actions", status_code=201)
async def create_action(graph_id: str, payload: ActionCreate, store: StoreDep):
    if not await store.get_graph(graph_id):
        raise HTTPException(404, "Decision graph not found")
    if payload.in_response_to:
        exp = await store.get_exposure(payload.in_response_to)
        if not exp or exp.graph_id != graph_id:
            raise HTTPException(400, "in_response_to must be an exposure in this graph")
    return await store.create_action(graph_id, payload)


@api_router.get("/actions/{action_id}")
async def get_action(action_id: str, store: StoreDep):
    action = await store.get_action(action_id)
    if not action:
        raise HTTPException(404, "Action not found")
    return action


@api_router.patch("/actions/{action_id}")
async def patch_action(action_id: str, payload: ActionUpdate, store: StoreDep):
    action = await store.update_action(action_id, payload)
    if not action:
        raise HTTPException(404, "Action not found")
    return action


@api_router.delete("/actions/{action_id}")
async def delete_action(action_id: str, store: StoreDep):
    ok = await store.delete_action(action_id)
    if not ok:
        raise HTTPException(404, "Action not found")
    return {"deleted": True}


@api_router.get("/graphs/{graph_id}/relationships")
async def list_relationships(graph_id: str, store: StoreDep):
    if not await store.get_graph(graph_id):
        raise HTTPException(404, "Decision graph not found")
    return await store.list_relationships(graph_id)


@api_router.post("/graphs/{graph_id}/relationships", status_code=201)
async def create_relationship(graph_id: str, payload: RelationshipCreate, store: StoreDep):
    if not await store.get_graph(graph_id):
        raise HTTPException(404, "Decision graph not found")
    return await store.create_relationship(graph_id, payload)


@api_router.patch("/relationships/{rel_id}")
async def patch_relationship(rel_id: str, payload: RelationshipUpdate, store: StoreDep):
    rel = await store.update_relationship(rel_id, payload)
    if not rel:
        raise HTTPException(404, "Relationship not found")
    return rel


@api_router.delete("/relationships/{rel_id}")
async def delete_relationship(rel_id: str, store: StoreDep):
    ok = await store.delete_relationship(rel_id)
    if not ok:
        raise HTTPException(404, "Relationship not found")
    return {"deleted": True}


@api_router.post("/graphs/{graph_id}/workflow/resulting-risk", status_code=201)
async def workflow_resulting_risk(graph_id: str, payload: ResultingRiskRequest, store: StoreDep):
    if not await store.get_graph(graph_id):
        raise HTTPException(404, "Decision graph not found")
    return await add_resulting_risk(store, graph_id, payload)


@api_router.get("/graphs/{graph_id}/analysis")
async def graph_analysis(graph_id: str, store: StoreDep):
    bundle = await bundle_for(store, graph_id)
    return bundle.analysis


@api_router.get("/graphs/{graph_id}/analysis/neighbourhood")
async def graph_neighbourhood(
    graph_id: str,
    store: StoreDep,
    node_id: str = Query(..., description="Node id of the form exposure:<id> or action:<id>"),
    depth: int = Query(1, ge=0, le=8),
):
    return await analysis_neighbourhood(store, graph_id, node_id, depth)


@api_router.get("/graphs/{graph_id}/analysis/upstream")
async def graph_upstream(graph_id: str, store: StoreDep, node_id: str):
    return await analysis_walk(store, graph_id, node_id, "upstream")


@api_router.get("/graphs/{graph_id}/analysis/downstream")
async def graph_downstream(graph_id: str, store: StoreDep, node_id: str):
    return await analysis_walk(store, graph_id, node_id, "downstream")


@api_router.get("/graphs/{graph_id}/analysis/paths")
async def graph_paths(graph_id: str, store: StoreDep, source: str, target: str):
    return await analysis_paths(store, graph_id, source, target)


@api_router.get("/graphs/{graph_id}/analysis/cycles")
async def graph_cycles(graph_id: str, store: StoreDep):
    bundle = await bundle_for(store, graph_id)
    return bundle.analysis.cycles


@api_router.get("/graphs/{graph_id}/analysis/decision-path")
async def graph_decision_path(graph_id: str, store: StoreDep, action_id: str):
    return await analysis_branch(store, graph_id, action_id)


@api_router.get("/graphs/{graph_id}/analysis/compare-actions")
async def graph_compare(graph_id: str, store: StoreDep, exposure_id: str):
    return await analysis_compare(store, graph_id, exposure_id)


@api_router.get("/search")
async def search_all(store: StoreDep, q: str = Query(..., min_length=1)):
    return await search(store, q)


@api_router.get("/register")
async def register(store: StoreDep, graph_id: str | None = None):
    graphs = {g.id: g for g in await store.list_graphs()}
    rows = []
    exposures = await store.list_exposures(graph_id) if graph_id else await store.list_exposures()
    for exp in exposures:
        risk = await store.get_risk(exp.risk_id)
        graph = graphs.get(exp.graph_id)
        actions = []
        if graph:
            rels = await store.list_relationships(graph.id)
            action_ids = [
                r.target_id
                for r in rels
                if r.source_kind == "exposure" and r.source_id == exp.id and r.target_kind == "action"
            ]
            all_actions = await store.list_actions(graph.id)
            by_id = {a.id: a for a in all_actions}
            actions = [by_id[i].title for i in action_ids if i in by_id]
        rows.append(
            {
                "exposure": exposure_public(exp, risk.title if risk else None),
                "risk_title": risk.title if risk else "",
                "graph_id": exp.graph_id,
                "graph_title": graph.title if graph else "",
                "linked_actions": actions,
            }
        )
    return rows


@api_router.post("/seed")
async def seed(store: StoreDep, replace: bool = True):
    return await load_demo(store, replace=replace)
