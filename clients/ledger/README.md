# Ellensúly · Ledger

A second, independent client of the Ellensúly API. It shares no code, framework or build tooling with `frontend/`, which is the point: the API really is the only contract a UI needs.

| | `frontend/` | `clients/ledger/` |
| --- | --- | --- |
| Stack | React 18, TypeScript, Vite, React Flow, ELK, Zustand | Plain ES modules and hand-drawn SVG. No npm dependencies, no build step |
| Starting point | The graph canvas | The **decision**: one risk, its alternatives side by side |
| Layout | ELK | Its own layered layout (`src/layout.js`) |

## Run it

With the API on `:8000` (see the top-level README):

```bash
python3 clients/ledger/serve.py            # http://127.0.0.1:8090
python3 clients/ledger/serve.py --port 9000 --api http://some-host:8000
```

`serve.py` uses only the standard library. It serves the static files and proxies `/api` and `/health`, so the browser stays same-origin and the API's CORS list does not need changing.

With Docker, alongside the rest of the stack:

```bash
docker compose --profile ledger up --build  # ledger on :8090 (LEDGER_PORT to change)
```

Plain `docker compose up` is unchanged; the ledger is opt-in.

## Views

**Alternatives** (the default). Pick the risk being decided. The focal exposure comes first, and exposures with no responses yet are listed too. Each recorded response becomes a lettered column showing:

- its decision status, editable inline;
- what the API's `compare-actions` landscape says about it: how many exposures it reaches and opens immediately, how deep the chain runs, the highest L × I, risks that are severe even if unlikely, weakly evidenced risks, cycles it enters, and any effect on the risk being decided;
- **what it sets in motion**: a consequence cascade built from the relationships, with the verb on every step;
- letters beside a risk naming the other alternatives that also lead to it.

There is no "best" column and no total. The layout is a comparison, not a ranking.

**Map.** The graph drawn with the grammar in `docs/visual-language.md`: rounded exposures, pill actions, verbs on edges. Keys `1`–`6` switch the six lenses (exposure, impact, urgency, uncertainty, connectivity, decision path). Cycles are drawn as dashed return arcs under the flow. The stored graph is never changed to make the drawing acyclic.

**Register.** The exposures as a table. Sort by L × I, impact, urgency, uncertainty or reach; each sort states the question it answers, and arrows show how far each risk moves from the L × I order. It is a quick way to see what a heat map hides.

**Structure.** The API's insights grouped by kind, one canonical risk in several contexts (radars side by side), convergence points, cycles and the methodology caveats.

**Inspector.** Select any exposure or action. An exposure gets:

- an assessment editor using the level names and definitions from `/config/assessment`;
- impact by dimension, where the overall impact is derived as the worst dimension, never an average;
- a five-axis radar;
- where else the same canonical risk occurs;
- structure metrics and connections.

Actions add resulting risks through `/workflow/resulting-risk`, with all three modes offered explicitly: a new risk, a known risk as a new exposure, or convergence on an exposure already on the map.

## Reach stops at the risk being decided

Some responses act back on the risk they answer. In the demo, *Add a second supplier* `decreases` *Critical supplier may miss delivery date*. The API does not follow that edge onward when it counts reach: doing so would credit each alternative with its siblings' consequences, and in the demo it made both supplier options appear to reach all 13 exposures. Instead, `compare-actions` reports such edges in `returns_to_origin`, and the ledger shows them as **Acts on this risk** in the column. The decision-path lens lights the answered risk and the branch's own landscape.

Metrics, cycles, convergence, insights, landscapes and decision paths all come from the server. The client only draws the consequence tree from edges the API already returned.

## Files

```
index.html     page shell
styles.css     the whole visual system; light and dark themes, print styles
serve.py       stdlib static server + API proxy
src/api.js     every endpoint the client uses, nothing else
src/model.js   pure: bundle indexing, consequence cascades, register sorts
src/layout.js  pure: layered layout (DFS back edges, longest-path ranks, dummy
               waypoints, barycentre ordering, isotonic vertical placement)
src/map.js     SVG graph and lenses
src/radar.js   SVG five-axis profile
src/views.js   screens, inspector, dialogs
src/app.js     state, hash routing, loading, keyboard, search
test/          node --test over the pure modules, against a captured demo bundle
```

## Tests

```bash
cd clients/ledger && node --test test/     # Node 18+, no install
```

## Keys

`/` search · `?` glossary · `1`–`6` lenses on the map · `Esc` closes the inspector · map nodes are focusable, and `Enter` selects.
