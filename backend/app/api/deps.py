from typing import Annotated

from fastapi import Depends, Request

from app.persistence.store import Store


async def get_store(request: Request) -> Store:
    return request.app.state.store


StoreDep = Annotated[Store, Depends(get_store)]
