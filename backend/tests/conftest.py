import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app
from app.persistence.store import MemoryStore
from app.seed.supplier_continuity import load_demo


@pytest.fixture
async def store():
    return MemoryStore()


@pytest.fixture
async def seeded_store(store):
    await load_demo(store, replace=True)
    return store


@pytest.fixture
async def app(store):
    application = create_app()
    application.state.store = store
    application.state.store_kind = "memory"
    application.state.mongo_client = None
    application.state.skip_seed = True
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def seeded_client(seeded_store):
    application = create_app()
    application.state.store = seeded_store
    application.state.store_kind = "memory"
    application.state.mongo_client = None
    application.state.skip_seed = True
    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
