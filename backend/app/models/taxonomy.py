"""Controlled vocabularies that remain extensible via free-text custom values."""

from typing import Literal

NODE_KINDS = ("exposure", "action")
NodeKind = Literal["exposure", "action"]

EXPOSURE_STATUSES = ("open", "monitoring", "treated", "closed")
ACTION_STATUSES = (
    "proposed",
    "under_consideration",
    "selected",
    "rejected",
    "deferred",
    "implemented",
)

DEFAULT_TREATMENT_CATEGORIES = (
    "accept",
    "avoid",
    "mitigate",
    "reduce",
    "transfer",
    "defer",
    "other",
)

# Action -> exposure (or exposure -> exposure) effect vocabulary.
RELATIONSHIP_SEMANTICS: dict[str, dict] = {
    # Exposure is addressed by an Action.
    "has_response": {
        "label": "has response",
        "from_kinds": ("exposure",),
        "to_kinds": ("action",),
        "directed": True,
        "family": "response",
        "help": "This action is a possible response to the risk exposure.",
    },
    # Action effects on exposures.
    "creates": {
        "label": "creates",
        "from_kinds": ("action",),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": True,
        "help": "The action introduces this risk into the landscape.",
    },
    "increases": {
        "label": "increases",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": True,
        "help": "The source makes this exposure more likely or more severe.",
    },
    "decreases": {
        "label": "decreases",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": False,
        "help": "The source reduces this exposure.",
    },
    "transfers": {
        "label": "transfers",
        "from_kinds": ("action",),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": True,
        "help": "The action moves exposure to another party or context.",
    },
    "exposes": {
        "label": "exposes",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": True,
        "help": "The source makes a previously latent risk relevant.",
    },
    "triggers": {
        "label": "triggers",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": True,
        "help": "The source can cause this exposure to materialise.",
    },
    "accelerates": {
        "label": "accelerates",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": True,
        "help": "The source increases velocity or proximity of this exposure.",
    },
    "delays": {
        "label": "delays",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": False,
        "help": "The source pushes this exposure further away in time.",
    },
    "contains": {
        "label": "contains",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": False,
        "help": "The source limits the spread of this exposure.",
    },
    "removes": {
        "label": "removes",
        "from_kinds": ("action",),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "effect",
        "counter_risk": False,
        "help": "The action is intended to eliminate this exposure.",
    },
    "affects": {
        "label": "affects",
        "from_kinds": ("action", "exposure"),
        "to_kinds": ("exposure", "action"),
        "directed": True,
        "family": "effect",
        "counter_risk": False,
        "help": "A general directed influence when a more specific verb does not fit.",
    },
    # Direct exposure-to-exposure relationships.
    "causes": {
        "label": "causes",
        "from_kinds": ("exposure",),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "causal",
        "help": "This exposure can bring about the target exposure.",
    },
    "contributes_to": {
        "label": "contributes to",
        "from_kinds": ("exposure", "action"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "causal",
        "help": "This exposure is one of several influences on the target.",
    },
    "amplifies": {
        "label": "amplifies",
        "from_kinds": ("exposure", "action"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "causal",
        "help": "This exposure magnifies the target if both are present.",
    },
    "suppresses": {
        "label": "suppresses",
        "from_kinds": ("exposure", "action"),
        "to_kinds": ("exposure",),
        "directed": True,
        "family": "causal",
        "help": "This exposure reduces the target if present.",
    },
    "depends_on": {
        "label": "depends on",
        "from_kinds": ("exposure", "action"),
        "to_kinds": ("exposure", "action"),
        "directed": True,
        "family": "structural",
        "help": "The source is contingent on the target.",
    },
    "prerequisite_for": {
        "label": "prerequisite for",
        "from_kinds": ("exposure", "action"),
        "to_kinds": ("exposure", "action"),
        "directed": True,
        "family": "structural",
        "help": "The source must be in play before the target.",
    },
    "correlated_with": {
        "label": "correlated with",
        "from_kinds": ("exposure",),
        "to_kinds": ("exposure",),
        "directed": False,
        "family": "symmetric",
        "help": "The two exposures tend to move together. This is not a claim of cause.",
    },
    "custom": {
        "label": "custom",
        "from_kinds": ("exposure", "action"),
        "to_kinds": ("exposure", "action"),
        "directed": True,
        "family": "custom",
        "help": "A user-defined relationship. The custom label carries the meaning.",
    },
}

COUNTER_RISK_SEMANTICS = frozenset(
    key for key, meta in RELATIONSHIP_SEMANTICS.items() if meta.get("counter_risk")
)
SYMMETRIC_SEMANTICS = frozenset(
    key for key, meta in RELATIONSHIP_SEMANTICS.items() if not meta["directed"]
)
DIRECTED_SEMANTICS = frozenset(
    key for key, meta in RELATIONSHIP_SEMANTICS.items() if meta["directed"]
)


def semantics_meta(semantics: str) -> dict:
    return RELATIONSHIP_SEMANTICS.get(semantics, RELATIONSHIP_SEMANTICS["custom"])
