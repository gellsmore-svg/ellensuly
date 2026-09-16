from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "ellensuly"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = (
        "http://localhost:5173,http://localhost:8080,"
        "http://127.0.0.1:5173,http://127.0.0.1:8080"
    )
    seed_on_start: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [part.strip() for part in self.cors_origins.split(",") if part.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
