// Layered left-to-right layout. Pure and deterministic; no DOM.
//
// 1. DFS from preferred roots marks back edges (edges into a node on the DFS stack).
//    These are the cycles. They stay in the graph; they are only drawn differently.
// 2. Longest-path ranking over the remaining DAG.
// 3. Edges spanning several ranks get dummy waypoints so they route between nodes.
// 4. Barycentre sweeps reduce crossings; vertical positions then relax toward neighbours.

export function layout(nodes, edges, opts = {}) {
  const {
    roots = [],
    size = () => ({ w: 180, h: 56 }),
    rankGap = 96,
    rowGap = 28,
    sweeps = 6,
  } = opts;

  const ids = [...nodes];
  const idSet = new Set(ids);
  const directed = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target);
  const outs = new Map(ids.map((n) => [n, []]));
  for (const e of directed) outs.get(e.source).push(e);

  // 1. Back edges by iterative DFS, roots first, then in-degree-0 nodes, then the rest.
  const indeg = new Map(ids.map((n) => [n, 0]));
  for (const e of directed) indeg.set(e.target, indeg.get(e.target) + 1);
  const order = [
    ...roots.filter((r) => idSet.has(r)),
    ...ids.filter((n) => indeg.get(n) === 0),
    ...ids,
  ];
  const state = new Map(); // undefined = unvisited, 1 = on stack, 2 = done
  const back = new Set();
  const discovery = [];
  for (const start of order) {
    if (state.has(start)) continue;
    const stack = [[start, 0]];
    state.set(start, 1);
    discovery.push(start);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [n, i] = top;
      const list = outs.get(n);
      if (i >= list.length) {
        state.set(n, 2);
        stack.pop();
        continue;
      }
      top[1] = i + 1;
      const e = list[i];
      const st = state.get(e.target);
      if (st === 1) back.add(e.id);
      else if (st === undefined) {
        state.set(e.target, 1);
        discovery.push(e.target);
        stack.push([e.target, 0]);
      }
    }
  }

  // 2. Longest-path ranks over the DAG (Kahn's order).
  const dag = directed.filter((e) => !back.has(e.id));
  const din = new Map(ids.map((n) => [n, 0]));
  const dout = new Map(ids.map((n) => [n, []]));
  for (const e of dag) {
    din.set(e.target, din.get(e.target) + 1);
    dout.get(e.source).push(e);
  }
  const rank = new Map(ids.map((n) => [n, 0]));
  const queue = discovery.filter((n) => din.get(n) === 0);
  const remaining = new Map(din);
  while (queue.length) {
    const n = queue.shift();
    for (const e of dout.get(n)) {
      rank.set(e.target, Math.max(rank.get(e.target), rank.get(n) + 1));
      remaining.set(e.target, remaining.get(e.target) - 1);
      if (remaining.get(e.target) === 0) queue.push(e.target);
    }
  }

  // 3. Dummy chains for long edges.
  const layerOf = new Map(rank);
  const dummySource = new Map();
  const chains = new Map(); // edge id -> [source, d1, d2, ..., target]
  const adjacency = []; // [upper, lower] pairs between consecutive ranks
  for (const e of dag) {
    const r0 = rank.get(e.source);
    const r1 = rank.get(e.target);
    const chain = [e.source];
    for (let r = r0 + 1; r < r1; r++) {
      const d = `⋯${e.id}:${r}`;
      layerOf.set(d, r);
      dummySource.set(d, e.source);
      chain.push(d);
    }
    chain.push(e.target);
    chains.set(e.id, chain);
    for (let i = 0; i < chain.length - 1; i++) adjacency.push([chain[i], chain[i + 1]]);
  }

  const maxRank = Math.max(0, ...layerOf.values());
  const layers = Array.from({ length: maxRank + 1 }, () => []);
  const firstSeen = new Map(discovery.map((n, i) => [n, i]));
  for (const [n, r] of layerOf) layers[r].push(n);
  for (const layer of layers) {
    const seen = (n) => firstSeen.get(dummySource.get(n) ?? n) ?? 1e9;
    layer.sort((a, b) => seen(a) - seen(b));
  }

  const ups = new Map();
  const downs = new Map();
  for (const n of layerOf.keys()) {
    ups.set(n, []);
    downs.set(n, []);
  }
  for (const [u, l] of adjacency) {
    downs.get(u).push(l);
    ups.get(l).push(u);
  }

  // 4. Barycentre sweeps.
  const pos = new Map();
  const reindex = () => layers.forEach((layer) => layer.forEach((n, i) => pos.set(n, i)));
  reindex();
  const bary = (n, neighbours) => {
    const list = neighbours.get(n);
    if (!list.length) return pos.get(n);
    return list.reduce((sum, m) => sum + pos.get(m), 0) / list.length;
  };
  for (let s = 0; s < sweeps; s++) {
    const down = s % 2 === 0;
    const range = down ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const layer of range) {
      const scored = layer.map((n) => [n, bary(n, down ? ups : downs), pos.get(n)]);
      scored.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
      layer.splice(0, layer.length, ...scored.map((x) => x[0]));
      layer.forEach((n, i) => pos.set(n, i));
    }
  }

  // Coordinates: x by rank (widest node per rank), y stacked then centred.
  const sizeOf = (n) => (n.startsWith("⋯") ? { w: 0, h: 8 } : size(n));
  const colWidth = layers.map((layer) => Math.max(0, ...layer.map((n) => sizeOf(n).w)));
  const colX = [];
  let x = 0;
  for (let r = 0; r <= maxRank; r++) {
    colX.push(x);
    x += colWidth[r] + rankGap;
  }
  // Vertical placement: start stacked, then pull every node toward the mean height of its
  // neighbours. Each layer is solved exactly as an isotonic regression (pool adjacent
  // violators), so order and minimum gaps are kept while total displacement is minimised.
  const gapBetween = (a, b) => (a.startsWith("⋯") || b.startsWith("⋯") ? rowGap / 2 : rowGap);
  const cy = new Map();
  for (const layer of layers) {
    let y = 0;
    layer.forEach((n, i) => {
      const hh = sizeOf(n).h;
      if (i) y += gapBetween(layer[i - 1], n);
      cy.set(n, y + hh / 2);
      y += hh;
    });
  }
  const placeLayer = (layer, desired) => {
    // z_i = y_i - offset_i must be non-decreasing; fit z to desired_i - offset_i.
    const offset = [0];
    for (let i = 1; i < layer.length; i++) {
      offset.push(offset[i - 1] + (sizeOf(layer[i - 1]).h + sizeOf(layer[i]).h) / 2 + gapBetween(layer[i - 1], layer[i]));
    }
    const blocks = [];
    layer.forEach((_, i) => {
      blocks.push({ sum: desired[i] - offset[i], count: 1 });
      while (blocks.length > 1) {
        const b = blocks[blocks.length - 1];
        const a = blocks[blocks.length - 2];
        if (a.sum / a.count <= b.sum / b.count) break;
        a.sum += b.sum;
        a.count += b.count;
        blocks.pop();
      }
    });
    let i = 0;
    for (const b of blocks) {
      const z = b.sum / b.count;
      for (let k = 0; k < b.count; k++, i++) cy.set(layer[i], z + offset[i]);
    }
  };
  const mean = (list) => list.reduce((sum, m) => sum + cy.get(m), 0) / list.length;
  for (let it = 0; it < 16; it++) {
    const mode = it >= 12 ? "both" : it % 2 === 0 ? "down" : "up";
    const order = mode === "up" ? [...layers.keys()].reverse() : [...layers.keys()];
    for (const r of order) {
      const layer = layers[r];
      const desired = layer.map((n) => {
        const list = mode === "down" ? ups.get(n) : mode === "up" ? downs.get(n) : [...ups.get(n), ...downs.get(n)];
        return list.length ? mean(list) : cy.get(n);
      });
      placeLayer(layer, desired);
    }
  }
  let top = Infinity;
  let bottom = -Infinity;
  for (const [n, c] of cy) {
    const hh = sizeOf(n).h;
    top = Math.min(top, c - hh / 2);
    bottom = Math.max(bottom, c + hh / 2);
  }
  const tallest = Math.max(0, bottom - top);
  const place = new Map();
  layers.forEach((layer, r) => {
    for (const n of layer) {
      const { w, h } = sizeOf(n);
      const y = cy.get(n) - h / 2 - top;
      place.set(n, { x: colX[r] + (colWidth[r] - w) / 2, y, w, h, rank: r, cx: colX[r] + colWidth[r] / 2, cy: y + h / 2 });
    }
  });

  const positions = new Map(ids.map((n) => [n, place.get(n)]));
  const routes = new Map();
  for (const e of directed) {
    if (back.has(e.id)) continue;
    routes.set(e.id, chains.get(e.id).map((n) => place.get(n)));
  }

  return {
    positions,
    routes,
    back,
    width: Math.max(0, x - rankGap),
    height: tallest,
    ranks: maxRank + 1,
  };
}
