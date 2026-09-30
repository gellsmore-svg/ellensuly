import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  cascade,
  decisionPoints,
  directReach,
  indexBundle,
  nid,
  rankShift,
  readLandscape,
  responsesOf,
  sharedIndex,
  sortedExposures,
} from "../src/model.js";
import { layout } from "../src/layout.js";

const bundle = JSON.parse(readFileSync(new URL("./fixture-bundle.json", import.meta.url)));
const compare = JSON.parse(readFileSync(new URL("./fixture-compare.json", import.meta.url)));
const ix = indexBundle(bundle);
const FOCAL = "exp-supplier-delay";

test("focal exposure is the first decision point and has three responses", () => {
  assert.equal(decisionPoints(ix)[0].id, FOCAL);
  assert.deepEqual(
    responsesOf(ix, FOCAL).map((a) => a.id).sort(),
    ["act-accept", "act-inhouse", "act-second-supplier"],
  );
});

test("cascade marks the decreases edge back to the root as feedback, not expanded", () => {
  const tree = cascade(ix, nid("action", "act-second-supplier"), { root: nid("exposure", FOCAL) });
  const back = tree.children.find((c) => c.id === nid("exposure", FOCAL));
  assert.equal(back.mark, "feedback");
  assert.equal(back.via.semantics, "decreases");
  assert.equal(back.children.length, 0);
});

test("cascade is cycle-safe and marks repeats instead of re-expanding", () => {
  const tree = cascade(ix, nid("exposure", FOCAL));
  const marks = [];
  const visit = (n) => {
    if (n.mark) marks.push(n.mark);
    n.children.forEach(visit);
  };
  visit(tree);
  assert.ok(marks.includes("feedback"));
  assert.ok(marks.includes("repeat"));
  assert.ok(!marks.includes("truncated"));
});

test("client cascade and server landscape agree: reach stops at the decided risk", () => {
  for (const landscape of compare) {
    const reading = readLandscape(ix, landscape, FOCAL);
    const drawn = [...directReach(reading.tree)].filter((n) => n.startsWith("exposure:")).map((n) => n.slice(9));
    assert.deepEqual(drawn.sort(), [...landscape.downstream_exposure_ids].sort(), landscape.action_title);
    assert.ok(!reading.exposures.includes(FOCAL));
  }
  const byId = new Map(compare.map((l) => [l.action_id, l]));
  assert.equal(byId.get("act-second-supplier").downstream_reachable_risks, 10);
  assert.equal(byId.get("act-inhouse").downstream_reachable_risks, 8);
  assert.deepEqual(readLandscape(ix, byId.get("act-inhouse"), FOCAL).returns.map((r) => r.semantics), ["decreases"]);
});

test("shared index uses the server landscapes", () => {
  const readings = new Map(compare.map((l) => [l.action_id, readLandscape(ix, l, FOCAL)]));
  const shared = sharedIndex(readings);
  assert.deepEqual(shared.get("exp-programme-delay").sort(), ["act-accept", "act-inhouse", "act-second-supplier"]);
  assert.ok(!shared.get("exp-qualification-cost").includes("act-inhouse"), "a sibling's risk is no longer credited");
});

test("register sorts disagree: the impact order is not the score order", () => {
  assert.equal(sortedExposures(ix, "impact")[0].id, "exp-customer-commit");
  assert.notEqual(sortedExposures(ix, "score")[0].id, "exp-customer-commit");
  const shift = rankShift(ix, "score", "impact");
  assert.ok(shift.get("exp-customer-commit") > 0);
});

test("directReach excludes feedback leaves", () => {
  const tree = cascade(ix, nid("action", "act-inhouse"), { root: nid("exposure", FOCAL) });
  assert.ok(!directReach(tree).has(nid("exposure", FOCAL)));
});

test("layout ranks the focal first, breaks only the recorded cycles, and places every node", () => {
  const result = layout(ix.nodes, ix.edges, { roots: [nid("exposure", FOCAL)] });
  assert.equal(result.positions.get(nid("exposure", FOCAL)).rank, 0);
  assert.deepEqual([...result.back].sort(), ["rel-hire-decreases-cap", "rel-inhouse-decreases", "rel-second-decreases"]);
  for (const n of ix.nodes) assert.ok(result.positions.get(n), n);
  for (const e of ix.edges) {
    if (result.back.has(e.id)) continue;
    const route = result.routes.get(e.id);
    assert.ok(route.length >= 2);
    assert.ok(route[0].rank < route[route.length - 1].rank, `${e.id} flows rightward`);
  }
});

test("layout places nodes in one rank without overlap", () => {
  const result = layout(ix.nodes, ix.edges, { roots: [nid("exposure", FOCAL)] });
  const byRank = new Map();
  for (const p of result.positions.values()) {
    if (!byRank.has(p.rank)) byRank.set(p.rank, []);
    byRank.get(p.rank).push(p);
  }
  for (const list of byRank.values()) {
    list.sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) assert.ok(list[i].y >= list[i - 1].y + list[i - 1].h);
  }
});

test("layout survives a pure cycle with no in-degree-0 node", () => {
  const nodes = ["a", "b", "c"];
  const edges = [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "ca", source: "c", target: "a" },
  ];
  const result = layout(nodes, edges);
  assert.equal(result.back.size, 1);
  assert.equal(result.positions.size, 3);
});
