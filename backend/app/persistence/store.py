"""Persistence boundary.

The rest of the application talks only to Store. MongoDB is one implementation.
MemoryStore exists for tests and keeps the API fully usable without a database.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Protocol

from pymongo import ASCENDING, TEXT, AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.ids import new_id
from app.models.assessment import AssessmentConfig, default_assessment_config
from app.models.entities import (
    Action,
    ActionCreate,
    ActionUpdate,
    DecisionGraph,
    DecisionGraphCreate,
    DecisionGraphUpdate,
    Relationship,
    RelationshipCreate,
    RelationshipUpdate,
    Risk,
    RiskCreate,
    RiskExposure,
    RiskExposureCreate,
    RiskExposureUpdate,
    RiskUpdate,
    utcnow,
)
from app.models.taxonomy import semantics_meta


def _apply(model, updates: dict[str, Any]):
    data = model.model_dump()
    for key, value in updates.items():
        if value is not None:
            data[key] = value
    data["modified_at"] = utcnow()
    return model.__class__(**data)


class Store(Protocol):
    async def ensure_indexes(self) -> None: ...
    async def get_config(self) -> AssessmentConfig: ...
    async def save_config(self, config: AssessmentConfig) -> AssessmentConfig: ...

    async def list_graphs(self) -> list[DecisionGraph]: ...
    async def get_graph(self, graph_id: str) -> DecisionGraph | None: ...
    async def create_graph(self, payload: DecisionGraphCreate) -> DecisionGraph: ...
    async def update_graph(self, graph_id: str, payload: DecisionGraphUpdate) -> DecisionGraph | None: ...
    async def delete_graph(self, graph_id: str) -> bool: ...

    async def list_risks(self) -> list[Risk]: ...
    async def get_risk(self, risk_id: str) -> Risk | None: ...
    async def create_risk(self, payload: RiskCreate) -> Risk: ...
    async def update_risk(self, risk_id: str, payload: RiskUpdate) -> Risk | None: ...
    async def delete_risk(self, risk_id: str) -> bool: ...
    async def search_risks(self, q: str) -> list[Risk]: ...

    async def list_exposures(self, graph_id: str | None = None, risk_id: str | None = None) -> list[RiskExposure]: ...
    async def get_exposure(self, exposure_id: str) -> RiskExposure | None: ...
    async def create_exposure(self, graph_id: str, payload: RiskExposureCreate, risk: Risk) -> RiskExposure: ...
    async def update_exposure(self, exposure_id: str, payload: RiskExposureUpdate) -> RiskExposure | None: ...
    async def delete_exposure(self, exposure_id: str) -> bool: ...

    async def list_actions(self, graph_id: str) -> list[Action]: ...
    async def get_action(self, action_id: str) -> Action | None: ...
    async def create_action(self, graph_id: str, payload: ActionCreate) -> Action: ...
    async def update_action(self, action_id: str, payload: ActionUpdate) -> Action | None: ...
    async def delete_action(self, action_id: str) -> bool: ...

    async def list_relationships(self, graph_id: str) -> list[Relationship]: ...
    async def get_relationship(self, rel_id: str) -> Relationship | None: ...
    async def create_relationship(self, graph_id: str, payload: RelationshipCreate) -> Relationship: ...
    async def update_relationship(self, rel_id: str, payload: RelationshipUpdate) -> Relationship | None: ...
    async def delete_relationship(self, rel_id: str) -> bool: ...

    async def replace_all(
        self,
        graphs: list[DecisionGraph],
        risks: list[Risk],
        exposures: list[RiskExposure],
        actions: list[Action],
        relationships: list[Relationship],
    ) -> None: ...

    async def clear(self) -> None: ...


class MemoryStore:
    def __init__(self) -> None:
        self.graphs: dict[str, DecisionGraph] = {}
        self.risks: dict[str, Risk] = {}
        self.exposures: dict[str, RiskExposure] = {}
        self.actions: dict[str, Action] = {}
        self.relationships: dict[str, Relationship] = {}
        self.config = default_assessment_config()

    async def ensure_indexes(self) -> None:
        return None

    async def get_config(self) -> AssessmentConfig:
        return self.config.model_copy(deep=True)

    async def save_config(self, config: AssessmentConfig) -> AssessmentConfig:
        self.config = config.model_copy(deep=True)
        return await self.get_config()

    async def list_graphs(self) -> list[DecisionGraph]:
        return [deepcopy(g) for g in sorted(self.graphs.values(), key=lambda g: g.modified_at, reverse=True)]

    async def get_graph(self, graph_id: str) -> DecisionGraph | None:
        g = self.graphs.get(graph_id)
        return deepcopy(g) if g else None

    async def create_graph(self, payload: DecisionGraphCreate) -> DecisionGraph:
        graph = DecisionGraph(id=new_id(), **payload.model_dump())
        self.graphs[graph.id] = graph
        return deepcopy(graph)

    async def update_graph(self, graph_id: str, payload: DecisionGraphUpdate) -> DecisionGraph | None:
        current = self.graphs.get(graph_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        self.graphs[graph_id] = updated
        return deepcopy(updated)

    async def delete_graph(self, graph_id: str) -> bool:
        if graph_id not in self.graphs:
            return False
        del self.graphs[graph_id]
        self.exposures = {k: v for k, v in self.exposures.items() if v.graph_id != graph_id}
        self.actions = {k: v for k, v in self.actions.items() if v.graph_id != graph_id}
        self.relationships = {k: v for k, v in self.relationships.items() if v.graph_id != graph_id}
        return True

    async def list_risks(self) -> list[Risk]:
        return [deepcopy(r) for r in sorted(self.risks.values(), key=lambda r: r.title.lower())]

    async def get_risk(self, risk_id: str) -> Risk | None:
        r = self.risks.get(risk_id)
        return deepcopy(r) if r else None

    async def create_risk(self, payload: RiskCreate) -> Risk:
        risk = Risk(id=new_id(), **payload.model_dump())
        self.risks[risk.id] = risk
        return deepcopy(risk)

    async def update_risk(self, risk_id: str, payload: RiskUpdate) -> Risk | None:
        current = self.risks.get(risk_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        self.risks[risk_id] = updated
        return deepcopy(updated)

    async def delete_risk(self, risk_id: str) -> bool:
        if risk_id not in self.risks:
            return False
        in_use = any(e.risk_id == risk_id for e in self.exposures.values())
        if in_use:
            raise ValueError("Risk is referenced by one or more exposures")
        del self.risks[risk_id]
        return True

    async def search_risks(self, q: str) -> list[Risk]:
        needle = q.lower()
        return [
            deepcopy(r)
            for r in self.risks.values()
            if needle in r.title.lower()
            or needle in r.description.lower()
            or any(needle in t.lower() for t in r.tags)
        ]

    async def list_exposures(self, graph_id: str | None = None, risk_id: str | None = None) -> list[RiskExposure]:
        items = list(self.exposures.values())
        if graph_id:
            items = [e for e in items if e.graph_id == graph_id]
        if risk_id:
            items = [e for e in items if e.risk_id == risk_id]
        return [deepcopy(e) for e in items]

    async def get_exposure(self, exposure_id: str) -> RiskExposure | None:
        e = self.exposures.get(exposure_id)
        return deepcopy(e) if e else None

    async def create_exposure(self, graph_id: str, payload: RiskExposureCreate, risk: Risk) -> RiskExposure:
        data = payload.model_dump(exclude={"new_risk", "as_focal", "risk_id"})
        exp = RiskExposure(id=new_id(), graph_id=graph_id, risk_id=risk.id, **data)
        self.exposures[exp.id] = exp
        if payload.as_focal:
            graph = self.graphs.get(graph_id)
            if graph and exp.id not in graph.focal_exposure_ids:
                graph.focal_exposure_ids.append(exp.id)
                graph.modified_at = utcnow()
        return deepcopy(exp)

    async def update_exposure(self, exposure_id: str, payload: RiskExposureUpdate) -> RiskExposure | None:
        current = self.exposures.get(exposure_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        self.exposures[exposure_id] = updated
        return deepcopy(updated)

    async def delete_exposure(self, exposure_id: str) -> bool:
        if exposure_id not in self.exposures:
            return False
        graph_id = self.exposures[exposure_id].graph_id
        del self.exposures[exposure_id]
        self.relationships = {
            k: v
            for k, v in self.relationships.items()
            if not (
                (v.source_kind == "exposure" and v.source_id == exposure_id)
                or (v.target_kind == "exposure" and v.target_id == exposure_id)
            )
        }
        graph = self.graphs.get(graph_id)
        if graph and exposure_id in graph.focal_exposure_ids:
            graph.focal_exposure_ids = [i for i in graph.focal_exposure_ids if i != exposure_id]
        return True

    async def list_actions(self, graph_id: str) -> list[Action]:
        return [deepcopy(a) for a in self.actions.values() if a.graph_id == graph_id]

    async def get_action(self, action_id: str) -> Action | None:
        a = self.actions.get(action_id)
        return deepcopy(a) if a else None

    async def create_action(self, graph_id: str, payload: ActionCreate) -> Action:
        data = payload.model_dump(exclude={"in_response_to"})
        action = Action(id=new_id(), graph_id=graph_id, **data)
        self.actions[action.id] = action
        if payload.in_response_to:
            await self.create_relationship(
                graph_id,
                RelationshipCreate(
                    source_kind="exposure",
                    source_id=payload.in_response_to,
                    target_kind="action",
                    target_id=action.id,
                    semantics="has_response",
                ),
            )
        return deepcopy(action)

    async def update_action(self, action_id: str, payload: ActionUpdate) -> Action | None:
        current = self.actions.get(action_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        self.actions[action_id] = updated
        return deepcopy(updated)

    async def delete_action(self, action_id: str) -> bool:
        if action_id not in self.actions:
            return False
        del self.actions[action_id]
        self.relationships = {
            k: v
            for k, v in self.relationships.items()
            if not (
                (v.source_kind == "action" and v.source_id == action_id)
                or (v.target_kind == "action" and v.target_id == action_id)
            )
        }
        return True

    async def list_relationships(self, graph_id: str) -> list[Relationship]:
        return [deepcopy(r) for r in self.relationships.values() if r.graph_id == graph_id]

    async def get_relationship(self, rel_id: str) -> Relationship | None:
        r = self.relationships.get(rel_id)
        return deepcopy(r) if r else None

    async def create_relationship(self, graph_id: str, payload: RelationshipCreate) -> Relationship:
        meta = semantics_meta(payload.semantics)
        directed = payload.directed if payload.directed is not None else bool(meta["directed"])
        rel = Relationship(
            id=new_id(),
            graph_id=graph_id,
            source_kind=payload.source_kind,
            source_id=payload.source_id,
            target_kind=payload.target_kind,
            target_id=payload.target_id,
            semantics=payload.semantics,
            custom_label=payload.custom_label,
            directed=directed,
            notes=payload.notes,
        )
        self.relationships[rel.id] = rel
        graph = self.graphs.get(graph_id)
        if graph:
            graph.modified_at = utcnow()
        return deepcopy(rel)

    async def update_relationship(self, rel_id: str, payload: RelationshipUpdate) -> Relationship | None:
        current = self.relationships.get(rel_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        self.relationships[rel_id] = updated
        return deepcopy(updated)

    async def delete_relationship(self, rel_id: str) -> bool:
        if rel_id not in self.relationships:
            return False
        del self.relationships[rel_id]
        return True

    async def replace_all(
        self,
        graphs: list[DecisionGraph],
        risks: list[Risk],
        exposures: list[RiskExposure],
        actions: list[Action],
        relationships: list[Relationship],
    ) -> None:
        self.graphs = {g.id: g for g in graphs}
        self.risks = {r.id: r for r in risks}
        self.exposures = {e.id: e for e in exposures}
        self.actions = {a.id: a for a in actions}
        self.relationships = {r.id: r for r in relationships}

    async def clear(self) -> None:
        self.graphs.clear()
        self.risks.clear()
        self.exposures.clear()
        self.actions.clear()
        self.relationships.clear()
        self.config = default_assessment_config()


def _doc(model) -> dict:
    data = model.model_dump(mode="json")
    data["_id"] = data["id"]
    return data


def _load(cls, doc: dict):
    if doc is None:
        return None
    data = dict(doc)
    data.pop("_id", None)
    for key in ("created_at", "modified_at"):
        if isinstance(data.get(key), str):
            data[key] = datetime.fromisoformat(data[key])
    return cls(**data)


class MongoStore:
    def __init__(self, db: AsyncDatabase) -> None:
        self.db = db
        self.graphs = db["decision_graphs"]
        self.risks = db["risks"]
        self.exposures = db["risk_exposures"]
        self.actions = db["actions"]
        self.relationships = db["relationships"]
        self.config_col = db["assessment_config"]

    async def ensure_indexes(self) -> None:
        await self.graphs.create_index("title")
        await self.risks.create_index("title")
        await self.risks.create_index([("title", TEXT), ("description", TEXT), ("tags", TEXT)])
        await self.exposures.create_index("graph_id")
        await self.exposures.create_index("risk_id")
        await self.exposures.create_index([("graph_id", ASCENDING), ("risk_id", ASCENDING)])
        await self.actions.create_index("graph_id")
        await self.relationships.create_index("graph_id")
        await self.relationships.create_index(
            [("graph_id", ASCENDING), ("source_id", ASCENDING), ("target_id", ASCENDING)]
        )

    async def get_config(self) -> AssessmentConfig:
        doc = await self.config_col.find_one({"_id": "default"})
        if not doc:
            cfg = default_assessment_config()
            await self.save_config(cfg)
            return cfg
        data = dict(doc)
        data.pop("_id", None)
        return AssessmentConfig(**data)

    async def save_config(self, config: AssessmentConfig) -> AssessmentConfig:
        data = config.model_dump(mode="json")
        data["_id"] = "default"
        await self.config_col.replace_one({"_id": "default"}, data, upsert=True)
        return config

    async def list_graphs(self) -> list[DecisionGraph]:
        cursor = self.graphs.find().sort("modified_at", -1)
        return [_load(DecisionGraph, d) async for d in cursor]

    async def get_graph(self, graph_id: str) -> DecisionGraph | None:
        return _load(DecisionGraph, await self.graphs.find_one({"_id": graph_id}))

    async def create_graph(self, payload: DecisionGraphCreate) -> DecisionGraph:
        graph = DecisionGraph(id=new_id(), **payload.model_dump())
        await self.graphs.insert_one(_doc(graph))
        return graph

    async def update_graph(self, graph_id: str, payload: DecisionGraphUpdate) -> DecisionGraph | None:
        current = await self.get_graph(graph_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        await self.graphs.replace_one({"_id": graph_id}, _doc(updated))
        return updated

    async def delete_graph(self, graph_id: str) -> bool:
        result = await self.graphs.delete_one({"_id": graph_id})
        if result.deleted_count == 0:
            return False
        await self.exposures.delete_many({"graph_id": graph_id})
        await self.actions.delete_many({"graph_id": graph_id})
        await self.relationships.delete_many({"graph_id": graph_id})
        return True

    async def list_risks(self) -> list[Risk]:
        cursor = self.risks.find().sort("title", 1)
        return [_load(Risk, d) async for d in cursor]

    async def get_risk(self, risk_id: str) -> Risk | None:
        return _load(Risk, await self.risks.find_one({"_id": risk_id}))

    async def create_risk(self, payload: RiskCreate) -> Risk:
        risk = Risk(id=new_id(), **payload.model_dump())
        await self.risks.insert_one(_doc(risk))
        return risk

    async def update_risk(self, risk_id: str, payload: RiskUpdate) -> Risk | None:
        current = await self.get_risk(risk_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        await self.risks.replace_one({"_id": risk_id}, _doc(updated))
        return updated

    async def delete_risk(self, risk_id: str) -> bool:
        used = await self.exposures.find_one({"risk_id": risk_id})
        if used:
            raise ValueError("Risk is referenced by one or more exposures")
        result = await self.risks.delete_one({"_id": risk_id})
        return result.deleted_count == 1

    async def search_risks(self, q: str) -> list[Risk]:
        cursor = self.risks.find(
            {
                "$or": [
                    {"title": {"$regex": q, "$options": "i"}},
                    {"description": {"$regex": q, "$options": "i"}},
                    {"tags": {"$regex": q, "$options": "i"}},
                ]
            }
        )
        return [_load(Risk, d) async for d in cursor]

    async def list_exposures(self, graph_id: str | None = None, risk_id: str | None = None) -> list[RiskExposure]:
        query: dict[str, Any] = {}
        if graph_id:
            query["graph_id"] = graph_id
        if risk_id:
            query["risk_id"] = risk_id
        cursor = self.exposures.find(query)
        return [_load(RiskExposure, d) async for d in cursor]

    async def get_exposure(self, exposure_id: str) -> RiskExposure | None:
        return _load(RiskExposure, await self.exposures.find_one({"_id": exposure_id}))

    async def create_exposure(self, graph_id: str, payload: RiskExposureCreate, risk: Risk) -> RiskExposure:
        data = payload.model_dump(exclude={"new_risk", "as_focal", "risk_id"})
        exp = RiskExposure(id=new_id(), graph_id=graph_id, risk_id=risk.id, **data)
        await self.exposures.insert_one(_doc(exp))
        if payload.as_focal:
            graph = await self.get_graph(graph_id)
            if graph and exp.id not in graph.focal_exposure_ids:
                graph.focal_exposure_ids.append(exp.id)
                graph.modified_at = utcnow()
                await self.graphs.replace_one({"_id": graph_id}, _doc(graph))
        return exp

    async def update_exposure(self, exposure_id: str, payload: RiskExposureUpdate) -> RiskExposure | None:
        current = await self.get_exposure(exposure_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        await self.exposures.replace_one({"_id": exposure_id}, _doc(updated))
        return updated

    async def delete_exposure(self, exposure_id: str) -> bool:
        current = await self.get_exposure(exposure_id)
        if not current:
            return False
        await self.exposures.delete_one({"_id": exposure_id})
        await self.relationships.delete_many(
            {
                "$or": [
                    {"source_kind": "exposure", "source_id": exposure_id},
                    {"target_kind": "exposure", "target_id": exposure_id},
                ]
            }
        )
        graph = await self.get_graph(current.graph_id)
        if graph and exposure_id in graph.focal_exposure_ids:
            graph.focal_exposure_ids = [i for i in graph.focal_exposure_ids if i != exposure_id]
            await self.graphs.replace_one({"_id": graph.id}, _doc(graph))
        return True

    async def list_actions(self, graph_id: str) -> list[Action]:
        cursor = self.actions.find({"graph_id": graph_id})
        return [_load(Action, d) async for d in cursor]

    async def get_action(self, action_id: str) -> Action | None:
        return _load(Action, await self.actions.find_one({"_id": action_id}))

    async def create_action(self, graph_id: str, payload: ActionCreate) -> Action:
        data = payload.model_dump(exclude={"in_response_to"})
        action = Action(id=new_id(), graph_id=graph_id, **data)
        await self.actions.insert_one(_doc(action))
        if payload.in_response_to:
            await self.create_relationship(
                graph_id,
                RelationshipCreate(
                    source_kind="exposure",
                    source_id=payload.in_response_to,
                    target_kind="action",
                    target_id=action.id,
                    semantics="has_response",
                ),
            )
        return action

    async def update_action(self, action_id: str, payload: ActionUpdate) -> Action | None:
        current = await self.get_action(action_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        await self.actions.replace_one({"_id": action_id}, _doc(updated))
        return updated

    async def delete_action(self, action_id: str) -> bool:
        result = await self.actions.delete_one({"_id": action_id})
        if result.deleted_count == 0:
            return False
        await self.relationships.delete_many(
            {
                "$or": [
                    {"source_kind": "action", "source_id": action_id},
                    {"target_kind": "action", "target_id": action_id},
                ]
            }
        )
        return True

    async def list_relationships(self, graph_id: str) -> list[Relationship]:
        cursor = self.relationships.find({"graph_id": graph_id})
        return [_load(Relationship, d) async for d in cursor]

    async def get_relationship(self, rel_id: str) -> Relationship | None:
        return _load(Relationship, await self.relationships.find_one({"_id": rel_id}))

    async def create_relationship(self, graph_id: str, payload: RelationshipCreate) -> Relationship:
        meta = semantics_meta(payload.semantics)
        directed = payload.directed if payload.directed is not None else bool(meta["directed"])
        rel = Relationship(
            id=new_id(),
            graph_id=graph_id,
            source_kind=payload.source_kind,
            source_id=payload.source_id,
            target_kind=payload.target_kind,
            target_id=payload.target_id,
            semantics=payload.semantics,
            custom_label=payload.custom_label,
            directed=directed,
            notes=payload.notes,
        )
        await self.relationships.insert_one(_doc(rel))
        await self.graphs.update_one(
            {"_id": graph_id}, {"$set": {"modified_at": utcnow().isoformat()}}
        )
        return rel

    async def update_relationship(self, rel_id: str, payload: RelationshipUpdate) -> Relationship | None:
        current = await self.get_relationship(rel_id)
        if not current:
            return None
        updated = _apply(current, payload.model_dump(exclude_unset=True))
        await self.relationships.replace_one({"_id": rel_id}, _doc(updated))
        return updated

    async def delete_relationship(self, rel_id: str) -> bool:
        result = await self.relationships.delete_one({"_id": rel_id})
        return result.deleted_count == 1

    async def replace_all(
        self,
        graphs: list[DecisionGraph],
        risks: list[Risk],
        exposures: list[RiskExposure],
        actions: list[Action],
        relationships: list[Relationship],
    ) -> None:
        await self.clear()
        if graphs:
            await self.graphs.insert_many([_doc(g) for g in graphs])
        if risks:
            await self.risks.insert_many([_doc(r) for r in risks])
        if exposures:
            await self.exposures.insert_many([_doc(e) for e in exposures])
        if actions:
            await self.actions.insert_many([_doc(a) for a in actions])
        if relationships:
            await self.relationships.insert_many([_doc(r) for r in relationships])

    async def clear(self) -> None:
        await self.graphs.delete_many({})
        await self.risks.delete_many({})
        await self.exposures.delete_many({})
        await self.actions.delete_many({})
        await self.relationships.delete_many({})


async def create_mongo_store(uri: str, db_name: str) -> tuple[AsyncMongoClient, MongoStore]:
    client: AsyncMongoClient = AsyncMongoClient(uri)
    store = MongoStore(client[db_name])
    await store.ensure_indexes()
    return client, store
