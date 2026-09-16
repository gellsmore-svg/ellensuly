"""Cycle-safe graph construction and analysis.

The graph is a directed risk-decision graph, not a tree and not assumed acyclic.
"""

from __future__ import annotations

from collections import defaultdict, deque

import networkx as nx

from app.models.analysis import (
    ActionLandscape,
    CycleRecord,
    GraphAnalysis,
    Insight,
    Neighbourhood,
    NodeMetrics,
    Occurrence,
    PathRecord,
)
from app.models.entities import Action, Relationship, Risk, RiskExposure
from app.models.taxonomy import COUNTER_RISK_SEMANTICS


def node_id(kind: str, raw_id: str) -> str:
    return f"{kind}:{raw_id}"


def parse_node_id(nid: str) -> tuple[str, str]:
    kind, _, raw = nid.partition(":")
    return kind, raw


def build_digraph(
    exposures: list[RiskExposure],
    actions: list[Action],
    relationships: list[Relationship],
) -> nx.DiGraph:
    g = nx.DiGraph()
    for exp in exposures:
        g.add_node(
            node_id("exposure", exp.id),
            kind="exposure",
            raw_id=exp.id,
            risk_id=exp.risk_id,
            title=exp.contextual_description,
            exposure=exp,
        )
    for action in actions:
        g.add_node(
            node_id("action", action.id),
            kind="action",
            raw_id=action.id,
            title=action.title,
            action=action,
        )
    for rel in relationships:
        src = node_id(rel.source_kind, rel.source_id)
        tgt = node_id(rel.target_kind, rel.target_id)
        if src not in g or tgt not in g:
            continue
        g.add_edge(src, tgt, relationship=rel, id=rel.id, semantics=rel.semantics)
        if not rel.directed:
            g.add_edge(tgt, src, relationship=rel, id=rel.id, semantics=rel.semantics, reverse=True)
    return g


def _reachable(g: nx.DiGraph, origin: str, kind_filter: str | None = None) -> set[str]:
    """BFS with an explicit visited set. Safe in the presence of cycles."""
    seen: set[str] = set()
    queue: deque[str] = deque([origin])
    found: set[str] = set()
    while queue:
        current = queue.popleft()
        if current in seen:
            continue
        seen.add(current)
        if current != origin:
            if kind_filter is None or g.nodes[current]["kind"] == kind_filter:
                found.add(current)
        for nxt in g.successors(current):
            if nxt not in seen:
                queue.append(nxt)
    return found


def _reachable_undirected(g: nx.DiGraph, origin: str) -> set[str]:
    seen: set[str] = set()
    queue: deque[str] = deque([origin])
    while queue:
        current = queue.popleft()
        if current in seen:
            continue
        seen.add(current)
        for nxt in set(g.successors(current)) | set(g.predecessors(current)):
            if nxt not in seen:
                queue.append(nxt)
    return seen


def _depth_and_path(g: nx.DiGraph, focals: list[str], target: str) -> tuple[int | None, list[str] | None]:
    if not focals:
        return None, None
    best: tuple[int, list[str]] | None = None
    for focal in focals:
        if focal not in g:
            continue
        try:
            path = nx.shortest_path(g, focal, target)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue
        length = len(path) - 1
        if best is None or length < best[0]:
            best = (length, path)
    if best is None:
        return None, None
    return best


def _cycle_sccs(g: nx.DiGraph) -> list[set[str]]:
    """A node is in a cycle iff it belongs to a non-trivial strongly connected component."""
    sccs: list[set[str]] = []
    for component in nx.strongly_connected_components(g):
        if len(component) > 1:
            sccs.append(set(component))
        else:
            node = next(iter(component))
            if g.has_edge(node, node):
                sccs.append(set(component))
    return sccs


def _list_cycles(g: nx.DiGraph, limit: int = 40, max_len: int = 12) -> list[list[str]]:
    """Prefer one representative cycle per SCC; add short simple cycles when cheap."""
    cycles: list[list[str]] = []
    seen: set[tuple[str, ...]] = set()

    def _add(cycle: list[str]) -> None:
        if not cycle or len(cycle) > max_len * 4:
            # Keep representative SCC cycles even when long, but cap listed length
            # by storing a rotated canonical form of the full cycle for inspection.
            pass
        rotated = min((tuple(cycle[i:] + cycle[:i]) for i in range(len(cycle))), default=tuple(cycle))
        if rotated in seen:
            return
        seen.add(rotated)
        cycles.append(list(rotated))

    for scc in _cycle_sccs(g):
        sub = g.subgraph(scc)
        try:
            edge_cycle = nx.find_cycle(sub, orientation="original")
            nodes = [u for u, _v, *_rest in edge_cycle]
            _add(nodes)
        except nx.NetworkXNoCycle:
            continue
        if len(cycles) >= limit:
            return cycles

    if g.number_of_nodes() <= 48:
        try:
            for cycle in nx.simple_cycles(g):
                if len(cycle) > max_len:
                    continue
                _add(cycle)
                if len(cycles) >= limit:
                    break
        except nx.NetworkXNoCycle:
            pass
    return cycles


def analyse(
    exposures: list[RiskExposure],
    actions: list[Action],
    relationships: list[Relationship],
    risks: list[Risk],
    focal_exposure_ids: list[str] | None = None,
) -> GraphAnalysis:
    g = build_digraph(exposures, actions, relationships)
    risk_by_id = {r.id: r for r in exposures}
    risks_by_id = {r.id: r for r in risks}

    if focal_exposure_ids:
        focals = [node_id("exposure", i) for i in focal_exposure_ids if node_id("exposure", i) in g]
    else:
        focals = [
            n
            for n, data in g.nodes(data=True)
            if data["kind"] == "exposure" and g.in_degree(n) == 0
        ]

    undirected_components: list[set[str]] = []
    remaining = set(g.nodes)
    while remaining:
        origin = remaining.pop()
        comp = _reachable_undirected(g, origin)
        undirected_components.append(comp)
        remaining -= comp

    component_of = {}
    for comp in undirected_components:
        for n in comp:
            component_of[n] = comp

    cycles = _list_cycles(g)
    sccs = _cycle_sccs(g)
    cycle_records: list[CycleRecord] = []
    membership: dict[str, list[str]] = defaultdict(list)
    for idx, cycle in enumerate(cycles, start=1):
        cid = f"cycle-{idx}"
        labels = []
        for n in cycle:
            data = g.nodes[n]
            if data["kind"] == "action":
                labels.append(data["action"].title)
            else:
                risk = risks_by_id.get(data["exposure"].risk_id)
                labels.append(risk.title if risk else data["exposure"].id)
        record = CycleRecord(
            id=cid,
            node_ids=cycle,
            labels=labels,
            statement="This path feeds back into an earlier node.",
        )
        cycle_records.append(record)
        owners = set(cycle)
        for scc in sccs:
            if owners & scc:
                owners |= scc
        for n in owners:
            membership[n].append(cid)

    # Incoming distinct action paths to an exposure: predecessors that are actions,
    # plus directed incoming from other exposures.
    convergence_points: list[str] = []
    metrics: dict[str, NodeMetrics] = {}

    betweenness = nx.betweenness_centrality(g) if g.number_of_nodes() else {}
    degree = nx.degree_centrality(g) if g.number_of_nodes() else {}

    downstream_counts: dict[str, int] = {}
    for n in g.nodes:
        downstream_counts[n] = len(_reachable(g, n, kind_filter="exposure"))

    reach_values = [c for n, c in downstream_counts.items() if g.nodes[n]["kind"] == "exposure"]
    reach_threshold = 0
    if reach_values:
        ordered = sorted(reach_values, reverse=True)
        reach_threshold = max(3, ordered[0] // 2) if ordered[0] else 3

    between_values = list(betweenness.values())
    between_cut = 0.0
    if between_values:
        between_cut = max(between_values) * 0.5 if max(between_values) else 0.0

    for n, data in g.nodes(data=True):
        in_deg = g.in_degree(n)
        out_deg = g.out_degree(n)
        incoming_action_paths = sum(
            1 for pred in g.predecessors(n) if g.nodes[pred]["kind"] == "action"
        )
        is_convergence = data["kind"] == "exposure" and incoming_action_paths >= 2
        if is_convergence:
            convergence_points.append(n)
        depth, path = _depth_and_path(g, focals, n)
        bet = float(betweenness.get(n, 0.0))
        metrics[n] = NodeMetrics(
            node_id=n,
            kind=data["kind"],
            in_degree=int(in_deg),
            out_degree=int(out_deg),
            branching_factor=int(out_deg),
            downstream_risk_count=downstream_counts[n],
            upstream_risk_count=len(_reachable(g.reverse(copy=False), n, kind_filter="exposure"))
            if g.number_of_nodes()
            else 0,
            component_size=len(component_of.get(n, {n})),
            is_convergence=is_convergence,
            incoming_action_paths=incoming_action_paths,
            cycle_member=n in membership,
            cycle_ids=membership.get(n, []),
            depth_from_focal=depth,
            shortest_path_from_focal=path,
            degree_centrality=float(degree.get(n, 0.0)),
            betweenness_centrality=bet,
            structurally_important=bool(between_cut and bet >= between_cut and bet > 0),
            high_downstream_reach=downstream_counts[n] >= reach_threshold and downstream_counts[n] > 0,
        )

    # Restore reverse: using reverse(copy=False) mutates; rebuild if needed.
    # networkx DiGraph.reverse(copy=False) returns a reverse view and is safe.

    occurrences = _canonical_occurrences(exposures, risks)
    insights = _insights(metrics, cycle_records, occurrences, exposures, risks_by_id)

    return GraphAnalysis(
        node_count=g.number_of_nodes(),
        exposure_count=len(exposures),
        action_count=len(actions),
        relationship_count=len(relationships),
        weakly_connected_component_sizes=sorted((len(c) for c in undirected_components), reverse=True),
        cycles=cycle_records,
        convergence_points=convergence_points,
        repeated_canonical_risks=occurrences,
        metrics=metrics,
        insights=insights,
        focal_ids=focals,
    )


def _canonical_occurrences(exposures: list[RiskExposure], risks: list[Risk]) -> list[Occurrence]:
    by_risk: dict[str, list[RiskExposure]] = defaultdict(list)
    titles = {r.id: r.title for r in risks}
    for exp in exposures:
        by_risk[exp.risk_id].append(exp)
    out: list[Occurrence] = []
    for risk_id, exps in by_risk.items():
        if len(exps) < 2:
            continue
        out.append(
            Occurrence(
                risk_id=risk_id,
                risk_title=titles.get(risk_id, risk_id),
                count=len(exps),
                exposures=[
                    {
                        "id": e.id,
                        "graph_id": e.graph_id,
                        "contextual_description": e.contextual_description,
                        "likelihood": e.likelihood,
                        "impact": e.impact.overall,
                    }
                    for e in exps
                ],
            )
        )
    return out


def _insights(
    metrics: dict[str, NodeMetrics],
    cycles: list[CycleRecord],
    occurrences: list[Occurrence],
    exposures: list[RiskExposure],
    risks_by_id: dict[str, Risk],
) -> list[Insight]:
    insights: list[Insight] = []
    exp_by_id = {e.id: e for e in exposures}

    for nid, m in metrics.items():
        if m.high_downstream_reach and m.kind == "exposure":
            insights.append(
                Insight(
                    code="downstream_reach",
                    title="High downstream reach",
                    statement=f"{m.downstream_risk_count} risk exposures are reachable downstream from this node.",
                    explanation="Counted by cycle-safe traversal of directed relationships. Not a severity score.",
                    node_id=nid,
                    values={"downstream_risk_count": m.downstream_risk_count},
                )
            )
        if m.is_convergence:
            insights.append(
                Insight(
                    code="convergence",
                    title="Convergence point",
                    statement=f"This risk is reached through {m.incoming_action_paths} different action paths.",
                    explanation="Incoming action relationships only. Direct exposure-to-exposure edges are not counted here.",
                    node_id=nid,
                    values={"incoming_action_paths": m.incoming_action_paths},
                )
            )
        if m.structurally_important:
            insights.append(
                Insight(
                    code="structurally_important",
                    title="Structurally important",
                    statement="This item lies on many paths through the graph.",
                    explanation=(
                        f"Betweenness centrality is {m.betweenness_centrality:.3f}. "
                        "This is a structural measure, not an assessment of how severe the risk is."
                    ),
                    node_id=nid,
                    values={"betweenness_centrality": m.betweenness_centrality},
                    kind="structure",
                )
            )
        if m.cycle_member:
            insights.append(
                Insight(
                    code="cycle",
                    title="Cycle detected",
                    statement="This branch eventually feeds back into an earlier node.",
                    explanation="Cycles are stored and rendered. Traversal remains finite because each node is visited once.",
                    node_id=nid,
                    values={"cycle_ids": m.cycle_ids},
                )
            )

        if m.kind == "exposure":
            _, raw = parse_node_id(nid)
            exp = exp_by_id.get(raw)
            if exp and exp.confidence is not None and exp.confidence <= 2 and (exp.impact.overall or 0) >= 4:
                insights.append(
                    Insight(
                        code="uncertain_high_impact",
                        title="Assessment uncertainty",
                        statement="This exposure has low confidence despite a high impact assessment.",
                        explanation="Confidence is not likelihood. The assessment may need more evidence before it is trusted.",
                        node_id=nid,
                        values={"confidence": exp.confidence, "impact": exp.impact.overall},
                        kind="assessment",
                    )
                )
            if exp and (exp.likelihood or 0) <= 2 and (exp.impact.overall or 0) >= 4:
                insights.append(
                    Insight(
                        code="high_impact_low_likelihood",
                        title="Severe even if unlikely",
                        statement="Impact is high while likelihood is low. Exposure score alone can hide this.",
                        explanation="The impact lens exists so low-probability severe outcomes remain visible.",
                        node_id=nid,
                        values={"likelihood": exp.likelihood, "impact": exp.impact.overall},
                        kind="assessment",
                    )
                )

    for occ in occurrences:
        insights.append(
            Insight(
                code="shared_canonical",
                title="Shared underlying risk",
                statement=(
                    f"This canonical risk appears in {occ.count} different contexts "
                    "with different assessments."
                ),
                explanation="These are distinct exposures of the same Risk, not automatically the same graph node.",
                node_id=None,
                values={"risk_id": occ.risk_id, "count": occ.count},
                kind="reuse",
            )
        )

    for cycle in cycles:
        insights.append(
            Insight(
                code="cycle_graph",
                title="Cycle in the graph",
                statement="A directed cycle exists among: " + " → ".join(cycle.labels) + ".",
                explanation="Feedback can be a real feature of a risk landscape.",
                values={"cycle_id": cycle.id, "nodes": cycle.node_ids},
            )
        )

    return insights


def neighbourhood(g: nx.DiGraph, origin: str, depth: int = 1) -> Neighbourhood:
    if origin not in g:
        return Neighbourhood(origin=origin, depth=depth, node_ids=[], edge_ids=[])
    nodes = {origin}
    edges: set[str] = set()
    frontier = {origin}
    for _ in range(max(depth, 0)):
        nxt: set[str] = set()
        for n in frontier:
            for succ in g.successors(n):
                nxt.add(succ)
                rel = g.edges[n, succ]
                if "id" in rel:
                    edges.add(rel["id"])
            for pred in g.predecessors(n):
                nxt.add(pred)
                rel = g.edges[pred, n]
                if "id" in rel:
                    edges.add(rel["id"])
        nodes |= nxt
        frontier = nxt - nodes if False else nxt  # already unioned
        frontier = nxt
    return Neighbourhood(origin=origin, depth=depth, node_ids=list(nodes), edge_ids=list(edges))


def directed_walk(g: nx.DiGraph, origin: str, direction: str) -> list[str]:
    if origin not in g:
        return []
    if direction == "upstream":
        view = g.reverse(copy=True)
    else:
        view = g
    found = [origin, *sorted(_reachable(view, origin))]
    return found


def paths_between(g: nx.DiGraph, source: str, target: str, cutoff: int = 10) -> list[PathRecord]:
    if source not in g or target not in g:
        return []
    records: list[PathRecord] = []
    try:
        for path in nx.all_simple_paths(g, source, target, cutoff=cutoff):
            records.append(PathRecord(nodes=path, length=len(path) - 1))
            if len(records) >= 20:
                break
    except nx.NetworkXError:
        return []
    return records


def decision_branch(g: nx.DiGraph, action_nid: str) -> set[str]:
    """The landscape opened by choosing this action: the action plus everything downstream."""
    if action_nid not in g:
        return set()
    return {action_nid} | _reachable(g, action_nid)


def compare_actions(
    exposures: list[RiskExposure],
    actions: list[Action],
    relationships: list[Relationship],
    analysis: GraphAnalysis,
    exposure_id: str,
) -> list[ActionLandscape]:
    g = build_digraph(exposures, actions, relationships)
    origin = node_id("exposure", exposure_id)
    if origin not in g:
        return []
    candidate_actions = [
        succ
        for succ in g.successors(origin)
        if g.nodes[succ]["kind"] == "action"
        and g.edges[origin, succ].get("semantics") in ("has_response", "custom")
        or (g.nodes[succ]["kind"] == "action")
    ]
    # Deduplicate while keeping action successors of this exposure.
    candidate_actions = [
        succ for succ in g.successors(origin) if g.nodes[succ]["kind"] == "action"
    ]
    exp_index = {e.id: e for e in exposures}
    landscapes: list[ActionLandscape] = []
    downstream_by_action: dict[str, set[str]] = {}

    for aid in candidate_actions:
        action: Action = g.nodes[aid]["action"]
        immediate = [
            t for t in g.successors(aid) if g.nodes[t]["kind"] == "exposure"
        ]
        down = _reachable(g, aid, kind_filter="exposure")
        downstream_by_action[aid] = down
        highest = None
        high_imp_low_l: list[dict] = []
        low_conf: list[dict] = []
        central: list[dict] = []
        max_depth = 0
        for nid in down:
            _, raw = parse_node_id(nid)
            exp = exp_index.get(raw)
            if not exp:
                continue
            score = exp.exposure.score
            if score is not None and (highest is None or score > highest["score"]):
                highest = {
                    "exposure_id": exp.id,
                    "score": score,
                    "likelihood": exp.likelihood,
                    "impact": exp.impact.overall,
                    "band": exp.exposure.band,
                }
            if (exp.impact.overall or 0) >= 4 and (exp.likelihood or 5) <= 2:
                high_imp_low_l.append({"exposure_id": exp.id, "likelihood": exp.likelihood, "impact": exp.impact.overall})
            if exp.confidence is not None and exp.confidence <= 2:
                low_conf.append({"exposure_id": exp.id, "confidence": exp.confidence})
            m = analysis.metrics.get(nid)
            if m and m.structurally_important:
                central.append({"node_id": nid, "betweenness": m.betweenness_centrality})
            m = analysis.metrics.get(nid)
            if m and m.depth_from_focal is not None:
                max_depth = max(max_depth, m.depth_from_focal)
        cycles_entered = sorted(
            {
                cid
                for nid in {aid} | down
                for cid in (analysis.metrics.get(nid).cycle_ids if analysis.metrics.get(nid) else [])
            }
        )
        landscapes.append(
            ActionLandscape(
                action_id=action.id,
                action_title=action.title,
                treatment_category=action.treatment_category,
                decision_status=action.decision_status,
                immediate_resulting_risks=len(immediate),
                downstream_reachable_risks=len(down),
                highest_exposure=highest,
                high_impact_low_likelihood=high_imp_low_l,
                low_confidence=low_conf,
                structurally_central_downstream=central,
                depth=max_depth or None,
                cycles_entered=cycles_entered,
                resulting_exposure_ids=[parse_node_id(n)[1] for n in immediate],
                downstream_exposure_ids=[parse_node_id(n)[1] for n in down],
            )
        )

    for land in landscapes:
        aid = node_id("action", land.action_id)
        shared: dict[str, list[str]] = {}
        mine = downstream_by_action.get(aid, set())
        for other in landscapes:
            if other.action_id == land.action_id:
                continue
            oid = node_id("action", other.action_id)
            overlap = mine & downstream_by_action.get(oid, set())
            if overlap:
                shared[other.action_id] = [parse_node_id(n)[1] for n in overlap]
        land.shared_with = shared
    return landscapes


def is_counter_risk_relationship(rel: Relationship) -> bool:
    return rel.source_kind == "action" and rel.semantics in COUNTER_RISK_SEMANTICS
