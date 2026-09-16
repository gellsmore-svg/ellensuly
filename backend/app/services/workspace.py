"""Application services over the store. Still UI-agnostic."""

from __future__ import annotations

from fastapi import HTTPException

from app.models.assessment import derived_overall_impact
from app.models.entities import (
    ActionCreate,
    ExposurePublic,
    GraphBundle,
    RelationshipCreate,
    ResultingRiskRequest,
    RiskCreate,
    RiskExposureCreate,
    SearchHit,
    exposure_public,
)
from app.models.glossary import glossary_list
from app.models.taxonomy import (
    ACTION_STATUSES,
    DEFAULT_TREATMENT_CATEGORIES,
    EXPOSURE_STATUSES,
    RELATIONSHIP_SEMANTICS,
)
from app.persistence.store import Store
from app.services.graph import (
    analyse,
    build_digraph,
    compare_actions,
    decision_branch,
    directed_walk,
    neighbourhood,
    node_id,
    paths_between,
)


async def resolve_risk(store: Store, payload: RiskExposureCreate):
    if payload.risk_id:
        risk = await store.get_risk(payload.risk_id)
        if not risk:
            raise HTTPException(404, "Canonical risk not found")
        return risk
    if payload.new_risk:
        return await store.create_risk(payload.new_risk)
    raise HTTPException(400, "Provide risk_id or new_risk")


async def bundle_for(store: Store, graph_id: str) -> GraphBundle:
    graph = await store.get_graph(graph_id)
    if not graph:
        raise HTTPException(404, "Decision graph not found")
    exposures = await store.list_exposures(graph_id)
    actions = await store.list_actions(graph_id)
    relationships = await store.list_relationships(graph_id)
    risk_ids = {e.risk_id for e in exposures}
    risks = []
    for rid in risk_ids:
        risk = await store.get_risk(rid)
        if risk:
            risks.append(risk)
    titles = {r.id: r.title for r in risks}
    analysis = analyse(exposures, actions, relationships, risks, graph.focal_exposure_ids)
    return GraphBundle(
        graph=graph,
        risks=risks,
        exposures=[exposure_public(e, titles.get(e.risk_id)) for e in exposures],
        actions=actions,
        relationships=relationships,
        analysis=analysis,
    )


def maybe_derive_impact(payload: RiskExposureCreate | dict) -> None:
    from app.models.assessment import ImpactAssessment

    impact = payload.get("impact") if isinstance(payload, dict) else getattr(payload, "impact", None)
    if impact is None:
        return
    if isinstance(impact, dict):
        impact_model = ImpactAssessment(**impact)
        if impact_model.overall is None and impact_model.dimensions:
            derived = derived_overall_impact(impact_model.dimensions)
            if derived is not None:
                impact_model.overall = derived
                impact_model.overall_source = "derived_max"
        if isinstance(payload, dict):
            payload["impact"] = impact_model
        else:
            payload.impact = impact_model
        return
    if impact.overall is None and impact.dimensions:
        derived = derived_overall_impact(impact.dimensions)
        if derived is not None:
            impact.overall = derived
            impact.overall_source = "derived_max"


async def add_resulting_risk(store: Store, graph_id: str, req: ResultingRiskRequest):
    action = await store.get_action(req.action_id)
    if not action or action.graph_id != graph_id:
        raise HTTPException(404, "Action not found in this graph")

    if req.mode == "existing_exposure":
        if not req.existing_exposure_id:
            raise HTTPException(400, "existing_exposure_id is required for convergence")
        exp = await store.get_exposure(req.existing_exposure_id)
        if not exp or exp.graph_id != graph_id:
            raise HTTPException(404, "Exposure not found in this graph")
    elif req.mode == "existing_risk_new_exposure":
        if not req.existing_risk_id:
            raise HTTPException(400, "existing_risk_id is required")
        risk = await store.get_risk(req.existing_risk_id)
        if not risk:
            raise HTTPException(404, "Canonical risk not found")
        data = req.exposure.model_dump(exclude_unset=True) if req.exposure else {}
        data.update({"risk_id": risk.id, "contextual_description": req.contextual_description or data.get("contextual_description", "")})
        create = RiskExposureCreate(**data)
        maybe_derive_impact(create)
        exp = await store.create_exposure(graph_id, create, risk)
    elif req.mode == "new_risk":
        if not req.new_risk:
            raise HTTPException(400, "new_risk is required")
        risk = await store.create_risk(req.new_risk)
        data = req.exposure.model_dump(exclude_unset=True) if req.exposure else {}
        data.update(
            {
                "risk_id": risk.id,
                "contextual_description": req.contextual_description
                or req.new_risk.description
                or data.get("contextual_description", ""),
            }
        )
        create = RiskExposureCreate(**data)
        maybe_derive_impact(create)
        exp = await store.create_exposure(graph_id, create, risk)
    else:
        raise HTTPException(400, "Unknown mode")

    rel = await store.create_relationship(
        graph_id,
        RelationshipCreate(
            source_kind="action",
            source_id=req.action_id,
            target_kind="exposure",
            target_id=exp.id,
            semantics=req.semantics,
            custom_label=req.custom_label,
            notes=req.notes,
        ),
    )
    return {"exposure": exposure_public(exp), "relationship": rel}


async def search(store: Store, q: str) -> list[SearchHit]:
    needle = q.strip()
    if not needle:
        return []
    hits: list[SearchHit] = []
    low = needle.lower()
    for graph in await store.list_graphs():
        if low in graph.title.lower() or low in graph.description.lower() or low in graph.objective.lower():
            hits.append(SearchHit(kind="graph", id=graph.id, graph_id=graph.id, title=graph.title, subtitle="Decision graph"))
        for exp in await store.list_exposures(graph.id):
            risk = await store.get_risk(exp.risk_id)
            title = risk.title if risk else exp.id
            blob = " ".join(
                [
                    title,
                    exp.contextual_description,
                    exp.assumptions,
                    exp.evidence,
                    exp.owner,
                    exp.status,
                ]
            ).lower()
            if low in blob:
                hits.append(
                    SearchHit(
                        kind="exposure",
                        id=exp.id,
                        graph_id=graph.id,
                        title=title,
                        subtitle=exp.contextual_description or "Risk exposure",
                    )
                )
        for action in await store.list_actions(graph.id):
            blob = " ".join([action.title, action.description, action.treatment_category, action.rationale]).lower()
            if low in blob:
                hits.append(
                    SearchHit(
                        kind="action",
                        id=action.id,
                        graph_id=graph.id,
                        title=action.title,
                        subtitle=action.treatment_category,
                    )
                )
        for rel in await store.list_relationships(graph.id):
            label = rel.display_label
            if low in label.lower() or low in rel.notes.lower() or low in rel.semantics.lower():
                hits.append(
                    SearchHit(
                        kind="relationship",
                        id=rel.id,
                        graph_id=graph.id,
                        title=label,
                        subtitle=f"{rel.source_kind} → {rel.target_kind}",
                    )
                )
    for risk in await store.search_risks(needle):
        hits.append(SearchHit(kind="risk", id=risk.id, title=risk.title, subtitle=risk.category or "Canonical risk"))
    return hits[:60]


def taxonomy_payload() -> dict:
    return {
        "treatment_categories": list(DEFAULT_TREATMENT_CATEGORIES),
        "action_statuses": list(ACTION_STATUSES),
        "exposure_statuses": list(EXPOSURE_STATUSES),
        "relationship_semantics": RELATIONSHIP_SEMANTICS,
        "glossary": [e.model_dump() for e in glossary_list()],
        "lenses": [
            {
                "id": "exposure",
                "title": "Exposure",
                "short": "Likelihood × impact as a familiar prioritisation lens.",
            },
            {
                "id": "impact",
                "title": "Impact",
                "short": "High-impact exposures remain visible even when likelihood is low.",
            },
            {
                "id": "urgency",
                "title": "Urgency",
                "short": "Proximity and velocity together: when it may occur, and how fast harm arrives.",
            },
            {
                "id": "uncertainty",
                "title": "Uncertainty",
                "short": "Low-confidence assessments, without pretending uncertainty is likelihood.",
            },
            {
                "id": "connectivity",
                "title": "Connectivity",
                "short": "Structure: reach, convergence, cycles, and items that sit on many paths.",
            },
            {
                "id": "decision",
                "title": "Decision path",
                "short": "The landscape that comes with a chosen action. Other branches recede, they do not vanish.",
            },
        ],
    }


async def graph_view(store: Store, graph_id: str):
    bundle = await bundle_for(store, graph_id)
    g = build_digraph(
        [await store.get_exposure(e.id) for e in bundle.exposures],  # type: ignore
        bundle.actions,
        bundle.relationships,
    )
    return bundle, g


async def analysis_neighbourhood(store: Store, graph_id: str, nid: str, depth: int):
    bundle = await bundle_for(store, graph_id)
    exposures = await store.list_exposures(graph_id)
    g = build_digraph(exposures, bundle.actions, bundle.relationships)
    return neighbourhood(g, nid, depth)


async def analysis_walk(store: Store, graph_id: str, nid: str, direction: str):
    bundle = await bundle_for(store, graph_id)
    exposures = await store.list_exposures(graph_id)
    g = build_digraph(exposures, bundle.actions, bundle.relationships)
    return {"node_ids": directed_walk(g, nid, direction)}


async def analysis_paths(store: Store, graph_id: str, source: str, target: str):
    bundle = await bundle_for(store, graph_id)
    exposures = await store.list_exposures(graph_id)
    g = build_digraph(exposures, bundle.actions, bundle.relationships)
    return paths_between(g, source, target)


async def analysis_branch(store: Store, graph_id: str, action_id: str):
    bundle = await bundle_for(store, graph_id)
    exposures = await store.list_exposures(graph_id)
    g = build_digraph(exposures, bundle.actions, bundle.relationships)
    nodes = sorted(decision_branch(g, node_id("action", action_id)))
    return {"action_id": action_id, "node_ids": nodes}


async def analysis_compare(store: Store, graph_id: str, exposure_id: str):
    bundle = await bundle_for(store, graph_id)
    exposures = await store.list_exposures(graph_id)
    return compare_actions(exposures, bundle.actions, bundle.relationships, bundle.analysis, exposure_id)
