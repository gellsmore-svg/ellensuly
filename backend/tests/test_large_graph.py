"""Architecture must not be limited to ten-node examples."""

from app.models.assessment import ImpactAssessment
from app.models.entities import Action, Relationship, Risk, RiskExposure
from app.services.graph import analyse, node_id


def test_cycle_safe_on_wide_graph():
    n = 80
    risks = [Risk(id=f"r{i}", title=f"Risk {i}") for i in range(n)]
    exposures = [
        RiskExposure(
            id=f"e{i}",
            graph_id="wide",
            risk_id=f"r{i}",
            likelihood=1 + (i % 5),
            impact=ImpactAssessment(overall=1 + ((i * 2) % 5)),
            confidence=1 + ((i * 3) % 5),
        )
        for i in range(n)
    ]
    actions = [Action(id=f"a{i}", graph_id="wide", title=f"Action {i}") for i in range(n)]
    rels: list[Relationship] = []
    for i in range(n):
        rels.append(
            Relationship(
                id=f"h{i}",
                graph_id="wide",
                source_kind="exposure",
                source_id=f"e{i}",
                target_kind="action",
                target_id=f"a{i}",
                semantics="has_response",
            )
        )
        rels.append(
            Relationship(
                id=f"c{i}",
                graph_id="wide",
                source_kind="action",
                source_id=f"a{i}",
                target_kind="exposure",
                target_id=f"e{(i + 1) % n}",
                semantics="creates",
            )
        )
        if i % 7 == 0:
            rels.append(
                Relationship(
                    id=f"x{i}",
                    graph_id="wide",
                    source_kind="action",
                    source_id=f"a{i}",
                    target_kind="exposure",
                    target_id=f"e{(i + 11) % n}",
                    semantics="increases",
                )
            )
    analysis = analyse(exposures, actions, rels, risks, ["e0"])
    assert analysis.node_count == n * 2
    assert analysis.cycles
    # Full cycle through every node: downstream from e0 reaches other exposures.
    assert analysis.metrics[node_id("exposure", "e0")].downstream_risk_count >= n - 1
