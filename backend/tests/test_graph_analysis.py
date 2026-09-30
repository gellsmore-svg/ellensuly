from app.models.assessment import ImpactAssessment
from app.models.entities import Action, Relationship, Risk, RiskExposure
from app.seed.supplier_continuity import build_demo
from app.services.graph import analyse, build_digraph, compare_actions, decision_branch, node_id


def _exp(eid, gid, rid, L=3, I=3, C=3):
    return RiskExposure(
        id=eid,
        graph_id=gid,
        risk_id=rid,
        likelihood=L,
        impact=ImpactAssessment(overall=I),
        confidence=C,
    )


def _rel(rid, sk, sid, tk, tid, sem="creates"):
    return Relationship(
        id=rid,
        graph_id="g",
        source_kind=sk,
        source_id=sid,
        target_kind=tk,
        target_id=tid,
        semantics=sem,
    )


def test_cycle_is_detected_and_traversal_terminates():
    exposures = [_exp("a", "g", "ra"), _exp("b", "g", "rb")]
    actions = [
        Action(id="1", graph_id="g", title="Act 1"),
        Action(id="2", graph_id="g", title="Act 2"),
    ]
    rels = [
        _rel("r1", "exposure", "a", "action", "1", "has_response"),
        _rel("r2", "action", "1", "exposure", "b", "creates"),
        _rel("r3", "exposure", "b", "action", "2", "has_response"),
        _rel("r4", "action", "2", "exposure", "a", "increases"),
    ]
    risks = [Risk(id="ra", title="A"), Risk(id="rb", title="B")]
    analysis = analyse(exposures, actions, rels, risks, ["a"])
    assert analysis.cycles, "cycle A → 1 → B → 2 → A must be detected"
    assert analysis.metrics[node_id("exposure", "a")].cycle_member
    assert analysis.metrics[node_id("exposure", "b")].downstream_risk_count >= 1


def test_convergence_on_shared_exposure():
    exposures = [_exp("root", "g", "r0"), _exp("shared", "g", "rs")]
    actions = [
        Action(id="a1", graph_id="g", title="Option A"),
        Action(id="a2", graph_id="g", title="Option B"),
    ]
    rels = [
        _rel("r1", "exposure", "root", "action", "a1", "has_response"),
        _rel("r2", "exposure", "root", "action", "a2", "has_response"),
        _rel("r3", "action", "a1", "exposure", "shared", "creates"),
        _rel("r4", "action", "a2", "exposure", "shared", "creates"),
    ]
    risks = [Risk(id="r0", title="Root"), Risk(id="rs", title="Shared")]
    analysis = analyse(exposures, actions, rels, risks, ["root"])
    shared = analysis.metrics[node_id("exposure", "shared")]
    assert shared.is_convergence
    assert shared.incoming_action_paths == 2
    assert node_id("exposure", "shared") in analysis.convergence_points


def test_repeated_canonical_risk_is_not_collapsed():
    exposures = [
        _exp("e1", "g", "capacity", 4, 4),
        _exp("e2", "g", "capacity", 2, 4, C=2),
    ]
    risks = [Risk(id="capacity", title="Loss of engineering capacity")]
    analysis = analyse(exposures, [], [], risks, ["e1"])
    assert len(analysis.repeated_canonical_risks) == 1
    occ = analysis.repeated_canonical_risks[0]
    assert occ.count == 2
    assert occ.risk_id == "capacity"


def test_compare_actions_does_not_rank():
    graphs, risks, exposures, actions, rels = build_demo()
    analysis = analyse(exposures, actions, rels, risks, graphs[0].focal_exposure_ids)
    landscapes = compare_actions(exposures, actions, rels, analysis, "exp-supplier-delay")
    assert len(landscapes) == 3
    for land in landscapes:
        assert "not a ranking" in land.caveat.lower()
        assert "total risk" in land.caveat.lower()
    titles = {land.action_title for land in landscapes}
    assert "Accept and monitor" in titles
    assert "Add a second supplier" in titles


def test_demo_graph_has_required_shapes():
    graphs, risks, exposures, actions, rels = build_demo()
    analysis = analyse(exposures, actions, rels, risks, graphs[0].focal_exposure_ids)
    assert analysis.cycles
    assert analysis.convergence_points
    assert analysis.repeated_canonical_risks
    g = build_digraph(exposures, actions, rels)
    # Not a tree: more than one path into programme delay.
    incoming = list(g.predecessors(node_id("exposure", "exp-programme-delay")))
    assert len(incoming) >= 2
    # Capacity appears twice as distinct nodes.
    cap_nodes = [n for n, d in g.nodes(data=True) if d["kind"] == "exposure" and d["exposure"].risk_id == "risk-capacity"]
    assert len(cap_nodes) == 2


def test_branching_from_root():
    graphs, risks, exposures, actions, rels = build_demo()
    g = build_digraph(exposures, actions, rels)
    root = node_id("exposure", "exp-supplier-delay")
    action_children = [n for n in g.successors(root) if g.nodes[n]["kind"] == "action"]
    assert len(action_children) == 3


def _demo_landscapes():
    graphs, risks, exposures, actions, rels = build_demo()
    analysis = analyse(exposures, actions, rels, risks, graphs[0].focal_exposure_ids)
    lands = compare_actions(exposures, actions, rels, analysis, "exp-supplier-delay")
    return analysis, {land.action_id: land for land in lands}


def test_reach_does_not_walk_back_through_the_decided_risk():
    _, lands = _demo_landscapes()
    # Both of these decrease the supplier-delay risk they answer. Walking on through it
    # used to credit each with all 13 exposures, including its siblings' consequences.
    assert lands["act-second-supplier"].downstream_reachable_risks == 10
    assert lands["act-inhouse"].downstream_reachable_risks == 8
    assert lands["act-accept"].downstream_reachable_risks == 2
    for land in lands.values():
        assert "exp-supplier-delay" not in land.downstream_exposure_ids
    inhouse = set(lands["act-inhouse"].downstream_exposure_ids)
    siblings_only = {
        "exp-qualification-cost",
        "exp-coordination",
        "exp-contract-lock",
        "exp-knowledge",
    }
    assert not inhouse & siblings_only


def test_effect_on_the_decided_risk_is_reported_not_traversed():
    _, lands = _demo_landscapes()
    returns = lands["act-second-supplier"].returns_to_origin
    assert returns == [
        {
            "node_id": "action:act-second-supplier",
            "relationship_id": "rel-second-decreases",
            "semantics": "decreases",
        }
    ]
    assert lands["act-accept"].returns_to_origin == []


def test_shared_exposures_and_cycles_reflect_the_branch_only():
    analysis, lands = _demo_landscapes()
    # In-house and second supplier genuinely share the integration sub-branch.
    shared = set(lands["act-inhouse"].shared_with["act-second-supplier"])
    assert "exp-integration" in shared
    assert "exp-qualification-cost" not in shared
    by_members = {frozenset(c.node_ids): c.id for c in analysis.cycles}
    hire_cycle = by_members[frozenset({"action:act-hire", "exposure:exp-capacity-inhouse"})]
    own = {land_id: by_members[frozenset({f"action:{land_id}", "exposure:exp-supplier-delay"})]
           for land_id in ("act-second-supplier", "act-inhouse")}
    assert lands["act-inhouse"].cycles_entered == sorted([hire_cycle, own["act-inhouse"]])
    assert lands["act-second-supplier"].cycles_entered == [own["act-second-supplier"]]
    assert lands["act-accept"].cycles_entered == []


def test_immediate_risks_exclude_the_decided_risk():
    _, lands = _demo_landscapes()
    second = lands["act-second-supplier"]
    assert "exp-supplier-delay" not in second.resulting_exposure_ids
    assert second.immediate_resulting_risks == 5
    assert lands["act-inhouse"].immediate_resulting_risks == 2


def test_decision_branch_keeps_its_root_but_not_sibling_branches():
    _, _, exposures, actions, rels = build_demo()
    g = build_digraph(exposures, actions, rels)
    branch = decision_branch(g, node_id("action", "act-inhouse"))
    assert node_id("exposure", "exp-supplier-delay") in branch
    assert node_id("action", "act-second-supplier") not in branch
    assert node_id("action", "act-accept") not in branch
    assert branch == {
        node_id("action", "act-inhouse"),
        node_id("exposure", "exp-supplier-delay"),  # the root it answers, kept as context
        node_id("action", "act-hire"),
        node_id("action", "act-harmonise"),
        *(
            node_id("exposure", e)
            for e in (
                "exp-capacity-inhouse",
                "exp-schedule-elsewhere",
                "exp-programme-delay",
                "exp-customer-commit",
                "exp-integration",
                "exp-rework",
                "exp-quality-variance",
                "exp-capacity-rework",
            )
        ),
    }


def test_indirect_path_back_to_the_root_is_reported_and_stopped():
    # r -has_response-> a -creates-> x -causes-> r -has_response-> b -creates-> y
    exposures = [_exp("r", "g", "R"), _exp("x", "g", "X"), _exp("y", "g", "Y")]
    actions = [Action(id="a", graph_id="g", title="A"), Action(id="b", graph_id="g", title="B")]
    rels = [
        _rel("1", "exposure", "r", "action", "a", "has_response"),
        _rel("2", "action", "a", "exposure", "x"),
        _rel("3", "exposure", "x", "exposure", "r", "causes"),
        _rel("4", "exposure", "r", "action", "b", "has_response"),
        _rel("5", "action", "b", "exposure", "y"),
    ]
    risks = [Risk(id=i, title=i) for i in "RXY"]
    analysis = analyse(exposures, actions, rels, risks, ["r"])
    lands = {
        land.action_id: land for land in compare_actions(exposures, actions, rels, analysis, "r")
    }
    assert lands["a"].downstream_exposure_ids == ["x"]
    assert lands["a"].returns_to_origin == [
        {"node_id": "exposure:x", "relationship_id": "3", "semantics": "causes"}
    ]
    assert "a" not in lands["b"].shared_with
