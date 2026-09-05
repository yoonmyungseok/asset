import json
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.database import DATA_DIR

CREDENTIALS_FILE = os.path.join(DATA_DIR, "toss_credentials.json")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    toss_client_id: str | None = None
    toss_client_secret: str | None = None
    toss_base_url: str = "https://openapi.tossinvest.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _load_file_credentials() -> tuple[str | None, str | None]:
    if not os.path.exists(CREDENTIALS_FILE):
        return None, None
    try:
        with open(CREDENTIALS_FILE, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None, None
    return data.get("client_id"), data.get("client_secret")


def get_toss_credentials() -> tuple[str | None, str | None]:
    settings = get_settings()
    client_id = settings.toss_client_id
    client_secret = settings.toss_client_secret
    if client_id and client_secret:
        return client_id, client_secret
    return _load_file_credentials()


def save_toss_credentials(client_id: str, client_secret: str) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CREDENTIALS_FILE, "w", encoding="utf-8") as handle:
        json.dump({"client_id": client_id, "client_secret": client_secret}, handle, ensure_ascii=False)


def clear_toss_credentials() -> None:
    if os.path.exists(CREDENTIALS_FILE):
        os.remove(CREDENTIALS_FILE)
