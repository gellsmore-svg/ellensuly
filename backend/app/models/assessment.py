"""Assessment model.

Ordinal 1–5 scales are the v1 default. Quantitative fields are optional and
forward-compatible. Derived values are labelled as lenses, never as scientific
ratios.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ScaleLevel(BaseModel):
    value: int = Field(ge=1, le=5)
    name: str
    definition: str


class ScaleDefinition(BaseModel):
    id: str
    title: str
    description: str
    teach: str
    levels: list[ScaleLevel]


class ImpactDimension(BaseModel):
    id: str
    label: str
    definition: str
    enabled: bool = True


class QuantitativeLikelihood(BaseModel):
    """Optional numeric likelihood. Unused by v1 scoring; reserved for later."""

    kind: Literal["point", "range", "frequency", "distribution"] = "point"
    point: float | None = Field(default=None, ge=0, le=1)
    low: float | None = Field(default=None, ge=0, le=1)
    high: float | None = Field(default=None, ge=0, le=1)
    frequency_per_year: float | None = Field(default=None, ge=0)
    distribution: dict | None = None
    notes: str = ""


class ImpactAssessment(BaseModel):
    overall: int | None = Field(default=None, ge=1, le=5)
    dimensions: dict[str, int] = Field(default_factory=dict)
    overall_source: Literal["user", "derived_max"] = "user"


class ExposureScore(BaseModel):
    """Prioritisation lens only. Not a ratio scale."""

    likelihood: int | None
    impact: int | None
    score: int | None
    band: str | None
    caveat: str = (
        "This is likelihood × impact on ordinal 1–5 scales. "
        "A score of 20 is not scientifically twice a score of 10. "
        "Use it as one familiar prioritisation lens, not as the definition of risk."
    )


class AssessmentConfig(BaseModel):
    likelihood: ScaleDefinition
    impact: ScaleDefinition
    proximity: ScaleDefinition
    velocity: ScaleDefinition
    confidence: ScaleDefinition
    persistence: ScaleDefinition
    persistence_enabled: bool = False
    impact_dimensions: list[ImpactDimension]
    overall_impact_rule: Literal["user_set", "max_dimension"] = "max_dimension"


def default_assessment_config() -> AssessmentConfig:
    return AssessmentConfig(
        likelihood=ScaleDefinition(
            id="likelihood",
            title="Likelihood",
            description="How plausible this exposure is in this decision context.",
            teach="How plausible this risk is in this decision context.",
            levels=[
                ScaleLevel(value=1, name="Rare", definition="Plausible only in exceptional circumstances."),
                ScaleLevel(value=2, name="Unlikely", definition="Could occur, but is not expected."),
                ScaleLevel(value=3, name="Possible", definition="Might occur during the decision horizon."),
                ScaleLevel(value=4, name="Likely", definition="More likely than not to occur."),
                ScaleLevel(value=5, name="Almost certain", definition="Expected to occur without intervention."),
            ],
        ),
        impact=ScaleDefinition(
            id="impact",
            title="Impact",
            description="How severe the consequences would be if the exposure materialises.",
            teach="How severe the consequences would be if it occurs.",
            levels=[
                ScaleLevel(value=1, name="Negligible", definition="Easily absorbed; no lasting consequence."),
                ScaleLevel(value=2, name="Minor", definition="Limited disruption; recoverable in the ordinary course."),
                ScaleLevel(value=3, name="Moderate", definition="Material disruption requiring active management."),
                ScaleLevel(value=4, name="Major", definition="Serious harm to objectives, commitments or people."),
                ScaleLevel(value=5, name="Severe", definition="Critical damage; objectives may fail."),
            ],
        ),
        proximity=ScaleDefinition(
            id="proximity",
            title="Proximity",
            description="How soon the risk could reasonably become material.",
            teach="How soon this risk may become material.",
            levels=[
                ScaleLevel(value=1, name="Distant", definition="Beyond the current planning horizon."),
                ScaleLevel(value=2, name="Medium-term", definition="Later in the programme, not pressing."),
                ScaleLevel(value=3, name="Near", definition="Within the current planning cycle."),
                ScaleLevel(value=4, name="Imminent", definition="Could become material very soon."),
                ScaleLevel(value=5, name="Now", definition="Already materialising, or on the threshold."),
            ],
        ),
        velocity=ScaleDefinition(
            id="velocity",
            title="Velocity",
            description="How quickly consequences develop once the risk occurs.",
            teach="How quickly consequences develop once the risk occurs.",
            levels=[
                ScaleLevel(value=1, name="Very slow", definition="Consequences unfold over a long period."),
                ScaleLevel(value=2, name="Slow", definition="There is time to organise a response after onset."),
                ScaleLevel(value=3, name="Moderate", definition="Consequences develop on a normal operational timescale."),
                ScaleLevel(value=4, name="Fast", definition="Harm accumulates quickly after onset."),
                ScaleLevel(value=5, name="Immediate", definition="Consequences arrive almost as soon as the event begins."),
            ],
        ),
        confidence=ScaleDefinition(
            id="confidence",
            title="Confidence",
            description="How strongly the available information supports this assessment.",
            teach="How strongly the available information supports this assessment.",
            levels=[
                ScaleLevel(value=1, name="Very low", definition="Little evidence; the assessment is largely conjecture."),
                ScaleLevel(value=2, name="Low", definition="Partial evidence; key assumptions are untested."),
                ScaleLevel(value=3, name="Moderate", definition="A reasoned view with remaining gaps."),
                ScaleLevel(value=4, name="High", definition="Well supported by evidence or experience."),
                ScaleLevel(value=5, name="Very high", definition="Strongly evidenced; residual doubt is small."),
            ],
        ),
        persistence=ScaleDefinition(
            id="persistence",
            title="Persistence",
            description="How long an impact remains material after it occurs. Optional in v1.",
            teach="How long the impact remains material after it occurs.",
            levels=[
                ScaleLevel(value=1, name="Fleeting", definition="Effects pass almost immediately."),
                ScaleLevel(value=2, name="Short", definition="Effects last days to a few weeks."),
                ScaleLevel(value=3, name="Medium", definition="Effects last through a planning cycle."),
                ScaleLevel(value=4, name="Long", definition="Effects last many months."),
                ScaleLevel(value=5, name="Enduring", definition="Effects are structural or effectively permanent."),
            ],
        ),
        persistence_enabled=False,
        impact_dimensions=[
            ImpactDimension(id="financial", label="Financial", definition="Direct or contingent monetary consequence."),
            ImpactDimension(id="schedule", label="Schedule", definition="Delay to commitments, milestones or delivery."),
            ImpactDimension(id="operational", label="Operational", definition="Disruption to running the work."),
            ImpactDimension(id="quality", label="Quality / performance", definition="Degradation of output, service or product."),
            ImpactDimension(id="customer", label="Customer", definition="Harm to customer outcomes or relationships."),
            ImpactDimension(id="legal", label="Legal / regulatory", definition="Legal, contractual or regulatory exposure."),
            ImpactDimension(id="reputation", label="Reputation", definition="Damage to standing with stakeholders."),
            ImpactDimension(id="safety", label="Safety", definition="Harm to people."),
            ImpactDimension(id="security", label="Security", definition="Compromise of systems, data or assets."),
            ImpactDimension(id="environmental", label="Environmental", definition="Harm to environment or climate commitments."),
            ImpactDimension(id="people", label="People / capacity", definition="Loss of skills, attention or organisational capacity."),
        ],
        overall_impact_rule="max_dimension",
    )


def derived_overall_impact(dimensions: dict[str, int]) -> int | None:
    """Worst filled dimension. Never an average of incompatible consequences."""
    values = [v for v in dimensions.values() if isinstance(v, int) and 1 <= v <= 5]
    return max(values) if values else None


def exposure_score(likelihood: int | None, impact: int | None) -> ExposureScore:
    if likelihood is None or impact is None:
        return ExposureScore(likelihood=likelihood, impact=impact, score=None, band=None)
    score = likelihood * impact
    if score <= 4:
        band = "low"
    elif score <= 9:
        band = "moderate"
    elif score <= 14:
        band = "elevated"
    elif score <= 19:
        band = "high"
    else:
        band = "extreme"
    return ExposureScore(likelihood=likelihood, impact=impact, score=score, band=band)


def uncertainty_from_confidence(confidence: int | None) -> int | None:
    """Invert confidence so that farther-from-centre on the radar means more concern."""
    if confidence is None:
        return None
    return 6 - confidence
