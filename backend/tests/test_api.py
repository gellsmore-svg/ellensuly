from app.seed.supplier_continuity import build_demo


async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["name"] == "Ellensúly"


async def test_create_graph_risk_action_downstream_reuse_and_convergence(client):
    g = await client.post("/api/v1/graphs", json={"title": "Platform migration", "objective": "Move off the legacy platform"})
    assert g.status_code == 201
    gid = g.json()["id"]

    risk = await client.post(
        "/api/v1/graphs/{}/exposures".format(gid),
        json={
            "new_risk": {"title": "Cutover failure", "category": "operational"},
            "contextual_description": "Go-live weekend",
            "likelihood": 3,
            "impact": {"overall": 5, "dimensions": {"operational": 5, "customer": 4}},
            "proximity": 4,
            "velocity": 5,
            "confidence": 2,
            "as_focal": True,
        },
    )
    assert risk.status_code == 201
    exposure = risk.json()
    assert exposure["risk_title"] == "Cutover failure"
    assert exposure["exposure"]["score"] == 15
    assert exposure["uncertainty"] == 4

    action_a = await client.post(
        f"/api/v1/graphs/{gid}/actions",
        json={"title": "Big-bang cutover", "treatment_category": "accept", "in_response_to": exposure["id"]},
    )
    action_b = await client.post(
        f"/api/v1/graphs/{gid}/actions",
        json={"title": "Strangle the legacy system", "treatment_category": "mitigate", "in_response_to": exposure["id"]},
    )
    assert action_a.status_code == 201
    assert action_b.status_code == 201

    down = await client.post(
        f"/api/v1/graphs/{gid}/workflow/resulting-risk",
        json={
            "action_id": action_a.json()["id"],
            "mode": "new_risk",
            "semantics": "creates",
            "new_risk": {"title": "Rollback window missed"},
            "contextual_description": "No time to reverse the cutover",
            "exposure": {"likelihood": 2, "impact": {"overall": 5}, "confidence": 3},
        },
    )
    assert down.status_code == 201
    rollback = down.json()["exposure"]

    # Reuse the same canonical risk as a new exposure (not convergence).
    reuse = await client.post(
        f"/api/v1/graphs/{gid}/workflow/resulting-risk",
        json={
            "action_id": action_b.json()["id"],
            "mode": "existing_risk_new_exposure",
            "semantics": "increases",
            "existing_risk_id": rollback["risk_id"],
            "contextual_description": "Prolonged dual-running still risks a missed rollback later",
            "exposure": {"likelihood": 3, "impact": {"overall": 3}, "confidence": 4},
        },
    )
    assert reuse.status_code == 201
    assert reuse.json()["exposure"]["id"] != rollback["id"]
    assert reuse.json()["exposure"]["risk_id"] == rollback["risk_id"]

    # Convergence: both actions create/increase a shared exposure node.
    shared_risk = await client.post("/api/v1/risks", json={"title": "Staff burnout"})
    shared_exp = await client.post(
        f"/api/v1/graphs/{gid}/exposures",
        json={"risk_id": shared_risk.json()["id"], "contextual_description": "The same people run both programmes", "likelihood": 4, "impact": {"overall": 3}},
    )
    seid = shared_exp.json()["id"]
    for aid in (action_a.json()["id"], action_b.json()["id"]):
        rel = await client.post(
            f"/api/v1/graphs/{gid}/relationships",
            json={
                "source_kind": "action",
                "source_id": aid,
                "target_kind": "exposure",
                "target_id": seid,
                "semantics": "increases",
            },
        )
        assert rel.status_code == 201

    bundle = await client.get(f"/api/v1/graphs/{gid}/bundle")
    assert bundle.status_code == 200
    body = bundle.json()
    assert body["analysis"]["convergence_points"]
    assert any(o["count"] == 2 for o in body["analysis"]["repeated_canonical_risks"])

    compare = await client.get(
        f"/api/v1/graphs/{gid}/analysis/compare-actions",
        params={"exposure_id": exposure["id"]},
    )
    assert compare.status_code == 200
    assert len(compare.json()) == 2

    register = await client.get("/api/v1/register", params={"graph_id": gid})
    assert register.status_code == 200
    assert len(register.json()) >= 3


async def test_custom_relationship_label(client):
    g = await client.post("/api/v1/graphs", json={"title": "Custom semantics"})
    gid = g.json()["id"]
    e1 = await client.post(
        f"/api/v1/graphs/{gid}/exposures",
        json={"new_risk": {"title": "Alpha"}, "likelihood": 2, "impact": {"overall": 2}},
    )
    e2 = await client.post(
        f"/api/v1/graphs/{gid}/exposures",
        json={"new_risk": {"title": "Beta"}, "likelihood": 2, "impact": {"overall": 2}},
    )
    rel = await client.post(
        f"/api/v1/graphs/{gid}/relationships",
        json={
            "source_kind": "exposure",
            "source_id": e1.json()["id"],
            "target_kind": "exposure",
            "target_id": e2.json()["id"],
            "semantics": "custom",
            "custom_label": "shadows",
        },
    )
    assert rel.status_code == 201
    assert rel.json()["custom_label"] == "shadows"


async def test_seeded_demo_endpoints(seeded_client):
    graphs, *_ = build_demo()
    gid = graphs[0].id
    bundle = await seeded_client.get(f"/api/v1/graphs/{gid}/bundle")
    assert bundle.status_code == 200
    data = bundle.json()
    assert data["graph"]["title"] == "Supplier continuity decision"
    assert data["analysis"]["cycles"]
    assert data["analysis"]["repeated_canonical_risks"]

    search = await seeded_client.get("/api/v1/search", params={"q": "capacity"})
    assert search.status_code == 200
    kinds = {h["kind"] for h in search.json()}
    assert "risk" in kinds

    occ = await seeded_client.get("/api/v1/risks/risk-capacity/occurrences")
    assert occ.status_code == 200
    assert len(occ.json()["occurrences"]) == 2

    heatmap_register = await seeded_client.get("/api/v1/register", params={"graph_id": gid})
    assert heatmap_register.status_code == 200
    scores = [row["exposure"]["exposure"]["score"] for row in heatmap_register.json()]
    assert any(s is not None for s in scores)
