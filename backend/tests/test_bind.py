import pytest
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.main import create_app
from app.persistence.store import MemoryStore


def _clear_settings() -> None:
    get_settings.cache_clear()


async def test_non_loopback_without_token_refuses(monkeypatch):
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.delenv("API_TOKEN", raising=False)
    _clear_settings()
    try:
        with pytest.raises(RuntimeError, match="API_TOKEN"):
            create_app()
    finally:
        _clear_settings()


async def test_whitespace_token_refuses(monkeypatch):
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.setenv("API_TOKEN", "bad token")
    _clear_settings()
    try:
        with pytest.raises(RuntimeError, match="whitespace"):
            create_app()
    finally:
        _clear_settings()


async def test_token_gates_routes_and_health_stays_open(monkeypatch):
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.setenv("API_TOKEN", "secret-token")
    _clear_settings()
    try:
        application = create_app()
        application.state.store = MemoryStore()
        application.state.store_kind = "memory"
        application.state.mongo_client = None
        application.state.skip_seed = True
        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/health")).status_code == 200
            assert (await client.get("/api/v1/graphs")).status_code == 401
            assert (await client.get("/api/docs")).status_code == 401
            allowed = await client.get(
                "/api/v1/graphs",
                headers={"Authorization": "Bearer secret-token"},
            )
            assert allowed.status_code == 200
            alternate = await client.get(
                "/api/v1/graphs",
                headers={"X-Ellensuly-Token": "secret-token"},
            )
            assert alternate.status_code == 200
            wrong = await client.get(
                "/api/v1/graphs",
                headers={"Authorization": "Bearer wrong"},
            )
            assert wrong.status_code == 401
    finally:
        _clear_settings()


async def test_wildcard_cors_origin_is_dropped(monkeypatch):
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.delenv("API_TOKEN", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "*")
    _clear_settings()
    try:
        assert get_settings().cors_origin_list == []
        create_app()
    finally:
        _clear_settings()
