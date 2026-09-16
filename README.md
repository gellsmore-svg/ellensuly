# Ellensúly

**Risk, in context.**

Acting on a risk changes the risk landscape. A response intended to reduce, avoid, transfer, defer or accept one risk can create, increase, expose or modify others. Those resulting risks may themselves require actions.

Traditional risk management gives us a list. Ellensúly maps that landscape as a **directed decision graph**.

The graph is not an accessory to a register. **The graph is the primary analytical object.**

```text
                    ┌─> Accept ─────────────> Programme delay
                    │
Supplier delay ─────┼─> Second supplier ────> Integration inconsistency
                    │                           │
                    │                           └─> Rework action ──> Capacity loss
                    │
                    └─> Bring in-house ──────> Capacity loss
```

`Capacity loss` may be either:

- one shared **exposure** reached by different branches (convergence on the same node); or
- several **contextual exposures** of the same **canonical Risk**, each with its own assessment.

That distinction is central. Ellensúly keeps both available, and makes the difference visible.

A counter-risk is not a verdict that an action is wrong. It is part of the landscape a decision creates.

## Run locally

```bash
git clone <this-repository>
cd ellensuly
cp .env.example .env
docker compose up --build
```

Then open [http://localhost:8080](http://localhost:8080). If port 8080 is already in use:

```bash
WEB_PORT=8088 docker compose up --build
```

| Service | Port |
| --- | --- |
| Web UI | 8080 (or `WEB_PORT`) |
| API (OpenAPI) | 8000 (`/api/docs`) |
| MongoDB | internal to Compose (not published) |

The demonstration **Supplier continuity decision** graph is seeded on first start.

### Developer mode (no Docker for the app)

MongoDB is still required for persistence. If it is not reachable, the API falls back to an in-memory store so the UI can be explored.

```bash
# terminal 1
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to the backend.

Reload the demo graph from the home screen, or:

```bash
curl -X POST http://localhost:8000/api/v1/seed
```

## What you should be able to do

1. Understand a Risk as a reusable concept, and an Exposure as that risk in a decision.
2. Record a familiar likelihood × impact assessment — as **one lens**, not the whole definition.
3. Add an Action as a first-class object.
4. See that the Action creates or changes other risks.
5. Follow the chain on the graph.
6. Compare alternative Actions by the landscapes they open, without a fake “best” score.
7. Recognise shared / convergent exposures and reused canonical risks.
8. Read a five-axis profile (likelihood, impact, immediacy, velocity, uncertainty).
9. Learn something from the **structure** of the graph that a spreadsheet would hide.

## Discrete UI and datastore

The browser never talks to MongoDB. The Python API is the only contract a user interface needs.

- Persistence, domain rules, graph analysis and teaching copy live in `backend/`.
- `frontend/` is one client of that API. Another UI can be added later without changing storage.
- OpenAPI: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

See [docs/architecture.md](docs/architecture.md).

## Documentation

- [Domain model](docs/domain-model.md)
- [Risk methodology](docs/risk-methodology.md)
- [Visual language](docs/visual-language.md)
- [Architecture](docs/architecture.md)
- [Visual experiments](docs/visual-experiments.md)

## Tests

```bash
cd backend && . .venv/bin/activate && pytest
cd frontend && npm test
cd frontend && npx playwright install chromium && npm run test:e2e
```

## Name

*Ellensúly* is Hungarian for a counterweight: the thing that balances a force by introducing another. That is the product’s stance on mitigation.
