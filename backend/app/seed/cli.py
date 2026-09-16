import argparse
import asyncio

from app.config import get_settings
from app.persistence.store import MemoryStore, create_mongo_store
from app.seed.supplier_continuity import load_demo


async def _run(replace: bool) -> None:
    settings = get_settings()
    try:
        client, store = await create_mongo_store(settings.mongodb_uri, settings.mongodb_db)
    except Exception:
        store = MemoryStore()
        client = None
    result = await load_demo(store, replace=replace)
    print(result)
    if client is not None:
        await client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the Ellensúly demonstration graph.")
    parser.add_argument("--replace", action="store_true", default=True)
    args = parser.parse_args()
    asyncio.run(_run(replace=args.replace))


if __name__ == "__main__":
    main()
