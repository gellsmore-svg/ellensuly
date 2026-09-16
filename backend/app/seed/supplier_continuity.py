"""Demonstration graph: supplier continuity.

Designed so a table cannot show what the graph shows:
branching alternatives, a shared downstream exposure, a reused canonical
risk with a different assessment, a cycle, and a moderate but structurally
central node.
"""

from __future__ import annotations

from app.models.assessment import ImpactAssessment
from app.models.entities import Action, DecisionGraph, Relationship, Risk, RiskExposure
from app.persistence.store import Store


def _imp(overall: int, **dims: int) -> ImpactAssessment:
    return ImpactAssessment(overall=overall, dimensions=dims, overall_source="user")


def build_demo() -> tuple[list[DecisionGraph], list[Risk], list[RiskExposure], list[Action], list[Relationship]]:
    graph = DecisionGraph(
        id="graph-supplier-continuity",
        title="Supplier continuity decision",
        description=(
            "A critical supplier may miss a delivery that a customer programme depends on. "
            "Each response changes the rest of the risk landscape."
        ),
        objective=(
            "Protect the customer programme without creating a worse operational landscape "
            "than the delay we are trying to avoid."
        ),
        focal_exposure_ids=["exp-supplier-delay"],
    )

    risks = [
        Risk(
            id="risk-supplier-delay",
            title="Critical supplier may miss delivery date",
            description="The incumbent supplier is the single source for a long-lead assembly.",
            category="supply",
            tags=["supplier", "schedule"],
        ),
        Risk(
            id="risk-programme-delay",
            title="Programme delay",
            description="The customer programme slips relative to the committed baseline.",
            category="schedule",
            tags=["schedule", "customer"],
        ),
        Risk(
            id="risk-customer-commit",
            title="Customer commitment failure",
            description="A contractual or reputational commitment to the customer is missed.",
            category="customer",
            tags=["customer", "contract"],
        ),
        Risk(
            id="risk-integration",
            title="Integration inconsistency",
            description="Two sources of the same assembly do not behave as one design.",
            category="quality",
            tags=["integration", "quality"],
        ),
        Risk(
            id="risk-qualification-cost",
            title="Duplicated qualification cost",
            description="A second source must be qualified, tested and contractually onboarded.",
            category="financial",
            tags=["cost", "supplier"],
        ),
        Risk(
            id="risk-coordination",
            title="Supplier coordination complexity",
            description="Two suppliers must be sequenced, informed and held to a common interface.",
            category="operational",
            tags=["coordination", "supplier"],
        ),
        Risk(
            id="risk-capacity",
            title="Loss of engineering capacity",
            description="Scarce engineering attention is consumed by unplanned work.",
            category="people",
            tags=["capacity", "people"],
        ),
        Risk(
            id="risk-schedule-elsewhere",
            title="Schedule disruption elsewhere",
            description="Pulling people onto this problem delays other committed work.",
            category="schedule",
            tags=["schedule", "portfolio"],
        ),
        Risk(
            id="risk-quality-variance",
            title="Quality variance between sources",
            description="Field performance diverges depending on which source built the unit.",
            category="quality",
            tags=["quality"],
        ),
        Risk(
            id="risk-contract-lock",
            title="Dual-source contractual lock-in",
            description="Volume commitments to two suppliers reduce later flexibility.",
            category="legal",
            tags=["contract"],
        ),
        Risk(
            id="risk-knowledge",
            title="Knowledge concentration in the incumbent",
            description="Design intent lives with one supplier's staff.",
            category="people",
            tags=["knowledge"],
        ),
        Risk(
            id="risk-rework",
            title="Rework cascade",
            description="Interface mismatches force repeated engineering rework.",
            category="operational",
            tags=["rework"],
        ),
    ]

    exposures = [
        RiskExposure(
            id="exp-supplier-delay",
            graph_id=graph.id,
            risk_id="risk-supplier-delay",
            contextual_description="Single-source assembly on the customer programme critical path.",
            likelihood=4,
            impact=_imp(4, schedule=4, customer=4, financial=3),
            proximity=4,
            velocity=4,
            confidence=4,
            assumptions="The supplier has already slipped internally by two weeks.",
            evidence="Last three shipments ran 8–12 days late. No contractual buffer remains.",
            owner="Programme lead",
            status="open",
        ),
        RiskExposure(
            id="exp-programme-delay",
            graph_id=graph.id,
            risk_id="risk-programme-delay",
            contextual_description="Customer programme misses the committed integration window.",
            likelihood=4,
            impact=_imp(4, schedule=4, customer=4),
            proximity=4,
            velocity=3,
            confidence=4,
            status="open",
        ),
        RiskExposure(
            id="exp-customer-commit",
            graph_id=graph.id,
            risk_id="risk-customer-commit",
            contextual_description="Missed delivery becomes a formal commitment failure.",
            likelihood=2,
            impact=_imp(5, customer=5, reputation=5, legal=4, financial=4),
            proximity=3,
            velocity=5,
            confidence=3,
            assumptions="The customer may grant a waiver; that is untested.",
            evidence="Contract has liquidated damages above a 10-day slip.",
            status="open",
        ),
        RiskExposure(
            id="exp-integration",
            graph_id=graph.id,
            risk_id="risk-integration",
            contextual_description="Second supplier's unit does not drop into the existing interface.",
            likelihood=3,
            impact=_imp(3, quality=3, schedule=3, operational=3),
            proximity=3,
            velocity=3,
            confidence=3,
            status="open",
        ),
        RiskExposure(
            id="exp-qualification-cost",
            graph_id=graph.id,
            risk_id="risk-qualification-cost",
            contextual_description="Qualification, tooling and legal onboarding of a second source.",
            likelihood=5,
            impact=_imp(2, financial=2),
            proximity=3,
            velocity=2,
            confidence=5,
            status="open",
        ),
        RiskExposure(
            id="exp-coordination",
            graph_id=graph.id,
            risk_id="risk-coordination",
            contextual_description="Two suppliers, one interface, one programme calendar.",
            likelihood=4,
            impact=_imp(3, operational=3, people=3, schedule=2),
            proximity=3,
            velocity=3,
            confidence=3,
            status="open",
        ),
        RiskExposure(
            id="exp-capacity-inhouse",
            graph_id=graph.id,
            risk_id="risk-capacity",
            contextual_description="Bringing the assembly in-house consumes the engineering group that also owns other critical path items.",
            likelihood=4,
            impact=_imp(4, people=4, schedule=4, operational=3),
            proximity=3,
            velocity=3,
            confidence=3,
            assumptions="Internal shop can be stood up in 10 weeks.",
            status="open",
        ),
        RiskExposure(
            id="exp-capacity-rework",
            graph_id=graph.id,
            risk_id="risk-capacity",
            contextual_description="Harmonising two supplier interfaces steals the same engineering group, in a different way.",
            likelihood=2,
            impact=_imp(4, people=4, quality=3),
            proximity=4,
            velocity=4,
            confidence=2,
            assumptions="Interface mismatch severity is inferred from a similar 2023 dual-source episode.",
            evidence="Thin. One analogous programme, different supplier pair.",
            status="open",
        ),
        RiskExposure(
            id="exp-schedule-elsewhere",
            graph_id=graph.id,
            risk_id="risk-schedule-elsewhere",
            contextual_description="Internal recovery pulls people off parallel commitments.",
            likelihood=3,
            impact=_imp(4, schedule=4, customer=3),
            proximity=3,
            velocity=3,
            confidence=3,
            status="open",
        ),
        RiskExposure(
            id="exp-quality-variance",
            graph_id=graph.id,
            risk_id="risk-quality-variance",
            contextual_description="Units from two sources diverge in the field.",
            likelihood=3,
            impact=_imp(3, quality=4, customer=3),
            proximity=2,
            velocity=2,
            confidence=2,
            status="open",
        ),
        RiskExposure(
            id="exp-contract-lock",
            graph_id=graph.id,
            risk_id="risk-contract-lock",
            contextual_description="Minimum-volume clauses with both suppliers.",
            likelihood=3,
            impact=_imp(3, legal=3, financial=3),
            proximity=2,
            velocity=1,
            confidence=4,
            status="open",
        ),
        RiskExposure(
            id="exp-knowledge",
            graph_id=graph.id,
            risk_id="risk-knowledge",
            contextual_description="Design intent remains inside the incumbent if we only dual-source the drawing pack.",
            likelihood=3,
            impact=_imp(3, people=4, operational=3),
            proximity=2,
            velocity=2,
            confidence=3,
            status="open",
        ),
        RiskExposure(
            id="exp-rework",
            graph_id=graph.id,
            risk_id="risk-rework",
            contextual_description="Each interface mismatch restarts qualification and drawing updates.",
            likelihood=3,
            impact=_imp(3, operational=3, people=3, schedule=3),
            proximity=3,
            velocity=4,
            confidence=3,
            status="open",
        ),
    ]

    actions = [
        Action(
            id="act-accept",
            graph_id=graph.id,
            title="Accept and monitor",
            description="Hold the incumbent, add reporting cadence, and plan for slip.",
            treatment_category="accept",
            decision_status="under_consideration",
            rationale="Avoids dual-source cost if the supplier recovers.",
            cost_effort="Low cash, high schedule exposure.",
        ),
        Action(
            id="act-second-supplier",
            graph_id=graph.id,
            title="Add a second supplier",
            description="Qualify an alternate source and split future volume.",
            treatment_category="transfer",
            decision_status="proposed",
            rationale="Reduces single-source failure, at the cost of a more complex landscape.",
            cost_effort="High qualification cost, medium ongoing coordination.",
        ),
        Action(
            id="act-inhouse",
            graph_id=graph.id,
            title="Bring work in-house",
            description="Stand up internal manufacture for the assembly.",
            treatment_category="avoid",
            decision_status="proposed",
            rationale="Removes supplier dependence. Consumes scarce engineering capacity.",
            cost_effort="High. Competes with other programmes for people.",
        ),
        Action(
            id="act-harmonise",
            graph_id=graph.id,
            title="Harmonise interfaces",
            description="Force a common interface specification across both suppliers.",
            treatment_category="mitigate",
            decision_status="proposed",
            rationale="Addresses integration inconsistency created by dual-sourcing.",
        ),
        Action(
            id="act-buffer",
            graph_id=graph.id,
            title="Add programme buffer",
            description="Protect the customer date with schedule contingency.",
            treatment_category="reduce",
            decision_status="proposed",
            rationale="Coordination complexity still threatens the date; a buffer absorbs some of that.",
        ),
        Action(
            id="act-simplify-vendors",
            graph_id=graph.id,
            title="Simplify the vendor map",
            description="Collapse interface ownership onto one supplier while keeping a second for volume.",
            treatment_category="reduce",
            decision_status="proposed",
            rationale="Intended to reduce coordination load after dual-sourcing.",
        ),
        Action(
            id="act-hire",
            graph_id=graph.id,
            title="Hire contractors for the in-house stand-up",
            description="Buy additional engineering capacity rather than reallocating the core team.",
            treatment_category="mitigate",
            decision_status="proposed",
            rationale="Tries to relieve capacity loss created by bringing work in-house.",
        ),
    ]

    def rel(
        rid: str,
        sk: str,
        sid: str,
        tk: str,
        tid: str,
        semantics: str,
        notes: str = "",
        directed: bool = True,
    ) -> Relationship:
        return Relationship(
            id=rid,
            graph_id=graph.id,
            source_kind=sk,  # type: ignore[arg-type]
            source_id=sid,
            target_kind=tk,  # type: ignore[arg-type]
            target_id=tid,
            semantics=semantics,
            directed=directed,
            notes=notes,
        )

    relationships = [
        # Root -> alternative actions
        rel("rel-delay-accept", "exposure", "exp-supplier-delay", "action", "act-accept", "has_response"),
        rel("rel-delay-second", "exposure", "exp-supplier-delay", "action", "act-second-supplier", "has_response"),
        rel("rel-delay-inhouse", "exposure", "exp-supplier-delay", "action", "act-inhouse", "has_response"),
        # Accept landscape
        rel("rel-accept-prog", "action", "act-accept", "exposure", "exp-programme-delay", "creates"),
        rel("rel-accept-cust", "action", "act-accept", "exposure", "exp-customer-commit", "increases"),
        rel("rel-prog-cust", "exposure", "exp-programme-delay", "exposure", "exp-customer-commit", "contributes_to"),
        # Dual-source landscape
        rel("rel-second-decreases", "action", "act-second-supplier", "exposure", "exp-supplier-delay", "decreases"),
        rel("rel-second-int", "action", "act-second-supplier", "exposure", "exp-integration", "creates"),
        rel("rel-second-qual", "action", "act-second-supplier", "exposure", "exp-qualification-cost", "creates"),
        rel("rel-second-coord", "action", "act-second-supplier", "exposure", "exp-coordination", "creates"),
        rel("rel-second-lock", "action", "act-second-supplier", "exposure", "exp-contract-lock", "creates"),
        rel("rel-second-know", "action", "act-second-supplier", "exposure", "exp-knowledge", "exposes"),
        # In-house landscape
        rel("rel-inhouse-decreases", "action", "act-inhouse", "exposure", "exp-supplier-delay", "decreases"),
        rel("rel-inhouse-cap", "action", "act-inhouse", "exposure", "exp-capacity-inhouse", "creates"),
        rel("rel-inhouse-sched", "action", "act-inhouse", "exposure", "exp-schedule-elsewhere", "creates"),
        rel("rel-sched-prog", "exposure", "exp-schedule-elsewhere", "exposure", "exp-programme-delay", "contributes_to"),
        # Convergence: dual-source coordination also feeds the SAME programme-delay exposure
        rel("rel-coord-buffer", "exposure", "exp-coordination", "action", "act-buffer", "has_response"),
        rel("rel-buffer-prog", "action", "act-buffer", "exposure", "exp-programme-delay", "creates"),
        # Integration branch, reused canonical capacity risk as a NEW exposure
        rel("rel-int-harm", "exposure", "exp-integration", "action", "act-harmonise", "has_response"),
        rel("rel-harm-rework", "action", "act-harmonise", "exposure", "exp-rework", "creates"),
        rel("rel-harm-quality", "action", "act-harmonise", "exposure", "exp-quality-variance", "decreases"),
        rel("rel-harm-cap", "action", "act-harmonise", "exposure", "exp-capacity-rework", "increases"),
        rel("rel-rework-cap", "exposure", "exp-rework", "exposure", "exp-capacity-rework", "amplifies"),
        # Cycle: integration -> harmonise -> coordination simplify -> integration
        rel("rel-coord-simplify", "exposure", "exp-coordination", "action", "act-simplify-vendors", "has_response"),
        rel("rel-simplify-int", "action", "act-simplify-vendors", "exposure", "exp-integration", "increases"),
        # In-house capacity response, which can increase integration if contractors are unfamiliar
        rel("rel-cap-hire", "exposure", "exp-capacity-inhouse", "action", "act-hire", "has_response"),
        rel("rel-hire-int", "action", "act-hire", "exposure", "exp-integration", "increases"),
        rel("rel-hire-decreases-cap", "action", "act-hire", "exposure", "exp-capacity-inhouse", "decreases"),
    ]

    return [graph], risks, exposures, actions, relationships


async def load_demo(store: Store, replace: bool = True) -> dict:
    graphs, risks, exposures, actions, relationships = build_demo()
    if replace:
        existing = await store.list_graphs()
        for g in existing:
            if g.id == graphs[0].id:
                await store.delete_graph(g.id)
        # Keep other graphs; replace demo entities by id via replace_all only if empty?
        # Safer: upsert demo by writing through replace of demo graph only.
        await store.delete_graph(graphs[0].id)
        # delete_graph already drops graph-scoped entities. Canonical risks may remain.
        for risk in risks:
            current = await store.get_risk(risk.id)
            if current is None:
                # insert with explicit id — Memory/Mongo stores allocate ids on create.
                # Use replace_all merge instead.
                pass
        # Merge: load current world, overlay demo ids.
        world_graphs = [g for g in await store.list_graphs() if g.id != graphs[0].id] + graphs
        world_risks_by_id = {r.id: r for r in await store.list_risks()}
        for r in risks:
            world_risks_by_id[r.id] = r
        world_exposures = [e for e in await store.list_exposures() if e.graph_id != graphs[0].id] + exposures
        world_actions = [a for a in await store.list_actions(graphs[0].id)]  # will be empty after delete
        # After delete_graph, actions for this graph are gone. Other graphs' actions:
        other_actions: list[Action] = []
        for g in world_graphs:
            if g.id == graphs[0].id:
                continue
            other_actions.extend(await store.list_actions(g.id))
        other_rels: list[Relationship] = []
        for g in world_graphs:
            if g.id == graphs[0].id:
                continue
            other_rels.extend(await store.list_relationships(g.id))
        await store.replace_all(
            world_graphs,
            list(world_risks_by_id.values()),
            world_exposures,
            other_actions + actions,
            other_rels + relationships,
        )
    else:
        await store.replace_all(graphs, risks, exposures, actions, relationships)

    return {
        "graph_id": graphs[0].id,
        "title": graphs[0].title,
        "risks": len(risks),
        "exposures": len(exposures),
        "actions": len(actions),
        "relationships": len(relationships),
    }
