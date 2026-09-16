from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.analysis import GraphAnalysis
from app.models.assessment import (
    ExposureScore,
    ImpactAssessment,
    QuantitativeLikelihood,
    exposure_score,
    uncertainty_from_confidence,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GraphViewState(BaseModel):
    """Optional layout hints. Alternative UIs may ignore this entirely."""

    positions: dict[str, dict[str, float]] = Field(default_factory=dict)
    last_lens: str | None = None
    last_focus_node: str | None = None


class DecisionGraph(BaseModel):
    id: str
    title: str
    description: str = ""
    objective: str = ""
    focal_exposure_ids: list[str] = Field(default_factory=list)
    view_state: GraphViewState = Field(default_factory=GraphViewState)
    created_at: datetime = Field(default_factory=utcnow)
    modified_at: datetime = Field(default_factory=utcnow)


class DecisionGraphCreate(BaseModel):
    title: str
    description: str = ""
    objective: str = ""


class DecisionGraphUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    objective: str | None = None
    focal_exposure_ids: list[str] | None = None
    view_state: GraphViewState | None = None


class Risk(BaseModel):
    """Canonical risk concept. Probability lives on exposures, not here."""

    id: str
    title: str
    description: str = ""
    category: str = ""
    tags: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    modified_at: datetime = Field(default_factory=utcnow)


class RiskCreate(BaseModel):
    title: str
    description: str = ""
    category: str = ""
    tags: list[str] = Field(default_factory=list)
    notes: str = ""


class RiskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    notes: str | None = None


class RiskExposure(BaseModel):
    """A canonical Risk as it exists inside a particular DecisionGraph."""

    id: str
    graph_id: str
    risk_id: str
    contextual_description: str = ""
    likelihood: int | None = Field(default=None, ge=1, le=5)
    impact: ImpactAssessment = Field(default_factory=ImpactAssessment)
    proximity: int | None = Field(default=None, ge=1, le=5)
    velocity: int | None = Field(default=None, ge=1, le=5)
    confidence: int | None = Field(default=None, ge=1, le=5)
    persistence: int | None = Field(default=None, ge=1, le=5)
    quantitative_likelihood: QuantitativeLikelihood | None = None
    assumptions: str = ""
    evidence: str = ""
    owner: str = ""
    status: str = "open"
    created_at: datetime = Field(default_factory=utcnow)
    modified_at: datetime = Field(default_factory=utcnow)

    @property
    def overall_impact(self) -> int | None:
        return self.impact.overall

    @property
    def exposure(self) -> ExposureScore:
        return exposure_score(self.likelihood, self.impact.overall)

    @property
    def uncertainty(self) -> int | None:
        return uncertainty_from_confidence(self.confidence)


class RiskExposureCreate(BaseModel):
    risk_id: str | None = None
    new_risk: RiskCreate | None = None
    contextual_description: str = ""
    likelihood: int | None = Field(default=None, ge=1, le=5)
    impact: ImpactAssessment = Field(default_factory=ImpactAssessment)
    proximity: int | None = Field(default=None, ge=1, le=5)
    velocity: int | None = Field(default=None, ge=1, le=5)
    confidence: int | None = Field(default=None, ge=1, le=5)
    persistence: int | None = Field(default=None, ge=1, le=5)
    quantitative_likelihood: QuantitativeLikelihood | None = None
    assumptions: str = ""
    evidence: str = ""
    owner: str = ""
    status: str = "open"
    as_focal: bool = False


class RiskExposureUpdate(BaseModel):
    risk_id: str | None = None
    contextual_description: str | None = None
    likelihood: int | None = Field(default=None, ge=1, le=5)
    impact: ImpactAssessment | None = None
    proximity: int | None = Field(default=None, ge=1, le=5)
    velocity: int | None = Field(default=None, ge=1, le=5)
    confidence: int | None = Field(default=None, ge=1, le=5)
    persistence: int | None = Field(default=None, ge=1, le=5)
    quantitative_likelihood: QuantitativeLikelihood | None = None
    assumptions: str | None = None
    evidence: str | None = None
    owner: str | None = None
    status: str | None = None


class Action(BaseModel):
    id: str
    graph_id: str
    title: str
    description: str = ""
    treatment_category: str = "mitigate"
    custom_category: str = ""
    decision_status: str = "proposed"
    rationale: str = ""
    cost_effort: str = ""
    assumptions: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    modified_at: datetime = Field(default_factory=utcnow)


class ActionCreate(BaseModel):
    title: str
    description: str = ""
    treatment_category: str = "mitigate"
    custom_category: str = ""
    decision_status: str = "proposed"
    rationale: str = ""
    cost_effort: str = ""
    assumptions: str = ""
    in_response_to: str | None = None


class ActionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    treatment_category: str | None = None
    custom_category: str | None = None
    decision_status: str | None = None
    rationale: str | None = None
    cost_effort: str | None = None
    assumptions: str | None = None


class Relationship(BaseModel):
    id: str
    graph_id: str
    source_kind: Literal["exposure", "action"]
    source_id: str
    target_kind: Literal["exposure", "action"]
    target_id: str
    semantics: str
    custom_label: str = ""
    directed: bool = True
    notes: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    modified_at: datetime = Field(default_factory=utcnow)

    @property
    def display_label(self) -> str:
        if self.semantics == "custom" and self.custom_label:
            return self.custom_label
        return self.semantics.replace("_", " ")


class RelationshipCreate(BaseModel):
    source_kind: Literal["exposure", "action"]
    source_id: str
    target_kind: Literal["exposure", "action"]
    target_id: str
    semantics: str
    custom_label: str = ""
    directed: bool | None = None
    notes: str = ""


class RelationshipUpdate(BaseModel):
    semantics: str | None = None
    custom_label: str | None = None
    directed: bool | None = None
    notes: str | None = None


class ResultingRiskRequest(BaseModel):
    """Add a risk that an action changes, with reuse / convergence options."""

    action_id: str
    semantics: str = "creates"
    custom_label: str = ""
    notes: str = ""
    mode: Literal["new_risk", "existing_risk_new_exposure", "existing_exposure"]
    existing_exposure_id: str | None = None
    existing_risk_id: str | None = None
    new_risk: RiskCreate | None = None
    exposure: RiskExposureUpdate | None = None
    contextual_description: str = ""


class ExposurePublic(BaseModel):
    """API shape with derived assessment lenses attached."""

    id: str
    graph_id: str
    risk_id: str
    contextual_description: str
    likelihood: int | None
    impact: ImpactAssessment
    proximity: int | None
    velocity: int | None
    confidence: int | None
    persistence: int | None
    quantitative_likelihood: QuantitativeLikelihood | None
    assumptions: str
    evidence: str
    owner: str
    status: str
    created_at: datetime
    modified_at: datetime
    exposure: ExposureScore
    uncertainty: int | None
    risk_title: str | None = None


def exposure_public(exp: RiskExposure, risk_title: str | None = None) -> ExposurePublic:
    return ExposurePublic(
        **exp.model_dump(),
        exposure=exp.exposure,
        uncertainty=exp.uncertainty,
        risk_title=risk_title,
    )


class GraphBundle(BaseModel):
    graph: DecisionGraph
    risks: list[Risk]
    exposures: list[ExposurePublic]
    actions: list[Action]
    relationships: list[Relationship]
    analysis: GraphAnalysis
    methodology_caveats: list[str] = Field(
        default_factory=lambda: [
            "Likelihood × impact is a prioritisation lens, not a complete definition of risk.",
            "Ordinal scores are not ratio quantities and must not be summed across a branch.",
            "A counter-risk is part of the landscape a decision creates, not a verdict that the action is wrong.",
            "Graph metrics describe structure, not severity.",
            "Low confidence is not high likelihood.",
        ]
    )


class SearchHit(BaseModel):
    kind: Literal["risk", "exposure", "action", "relationship", "graph"]
    id: str
    graph_id: str | None = None
    title: str
    subtitle: str = ""
    extra: dict[str, Any] = Field(default_factory=dict)
