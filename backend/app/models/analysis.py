from __future__ import annotations

from pydantic import BaseModel, Field


class NodeMetrics(BaseModel):
    node_id: str
    kind: str
    in_degree: int = 0
    out_degree: int = 0
    branching_factor: int = 0
    downstream_risk_count: int = 0
    upstream_risk_count: int = 0
    component_size: int = 0
    is_convergence: bool = False
    incoming_action_paths: int = 0
    cycle_member: bool = False
    cycle_ids: list[str] = Field(default_factory=list)
    depth_from_focal: int | None = None
    shortest_path_from_focal: list[str] | None = None
    degree_centrality: float = 0.0
    betweenness_centrality: float = 0.0
    structurally_important: bool = False
    high_downstream_reach: bool = False


class CycleRecord(BaseModel):
    id: str
    node_ids: list[str]
    labels: list[str] = Field(default_factory=list)
    statement: str


class Insight(BaseModel):
    code: str
    title: str
    statement: str
    explanation: str
    node_id: str | None = None
    values: dict = Field(default_factory=dict)
    kind: str = "structure"


class Occurrence(BaseModel):
    risk_id: str
    risk_title: str
    count: int
    exposures: list[dict]


class GraphAnalysis(BaseModel):
    node_count: int = 0
    exposure_count: int = 0
    action_count: int = 0
    relationship_count: int = 0
    weakly_connected_component_sizes: list[int] = Field(default_factory=list)
    cycles: list[CycleRecord] = Field(default_factory=list)
    convergence_points: list[str] = Field(default_factory=list)
    repeated_canonical_risks: list[Occurrence] = Field(default_factory=list)
    metrics: dict[str, NodeMetrics] = Field(default_factory=dict)
    insights: list[Insight] = Field(default_factory=list)
    focal_ids: list[str] = Field(default_factory=list)


class ActionLandscape(BaseModel):
    action_id: str
    action_title: str
    treatment_category: str
    decision_status: str
    immediate_resulting_risks: int
    downstream_reachable_risks: int
    highest_exposure: dict | None = None
    high_impact_low_likelihood: list[dict] = Field(default_factory=list)
    low_confidence: list[dict] = Field(default_factory=list)
    structurally_central_downstream: list[dict] = Field(default_factory=list)
    depth: int | None = None
    cycles_entered: list[str] = Field(default_factory=list)
    shared_with: dict[str, list[str]] = Field(default_factory=dict)
    resulting_exposure_ids: list[str] = Field(default_factory=list)
    downstream_exposure_ids: list[str] = Field(default_factory=list)
    caveat: str = (
        "These figures describe the landscape this action opens. "
        "They are not a ranking and must not be summed into a 'total risk' score."
    )


class Neighbourhood(BaseModel):
    origin: str
    depth: int
    node_ids: list[str]
    edge_ids: list[str]


class PathRecord(BaseModel):
    nodes: list[str]
    length: int
