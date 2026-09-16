from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.config import get_settings
from app.persistence.store import MemoryStore, create_mongo_store
from app.seed.supplier_continuity import load_demo


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    client = getattr(app.state, "mongo_client", None)
    if getattr(app.state, "store", None) is None:
        try:
            client, store = await create_mongo_store(settings.mongodb_uri, settings.mongodb_db)
            await client.admin.command("ping")
            app.state.store_kind = "mongo"
        except Exception:
            store = MemoryStore()
            app.state.store_kind = "memory"
            client = None
        app.state.store = store
        app.state.mongo_client = client
    store = app.state.store
    graphs = await store.list_graphs()
    skip_seed = getattr(app.state, "skip_seed", False)
    if settings.seed_on_start and not graphs and not skip_seed:
        await load_demo(store, replace=True)
    yield
    client = getattr(app.state, "mongo_client", None)
    if client is not None:
        await client.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Ellensúly API",
        summary="Risk, in context.",
        description=(
            "Acting on a risk changes the risk landscape. "
            "This API models that landscape as a directed decision graph. "
            "It is the only contract a user interface needs. "
            "Alternative UIs should consume these resources rather than the database."
        ),
        version=__version__,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "name": "Ellensúly",
            "version": __version__,
            "store": getattr(app.state, "store_kind", "unknown"),
        }

    return app


app = create_app()


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
