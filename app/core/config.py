from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    BOT_TOKEN: str = ""
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/homework_db"
    DEBUG: bool = False
    ALLOWED_ORIGIN: str = "*"
    FILE_STORAGE_DIR: str = "./uploads"
    FALLBACK_SYNC_INTERVAL: int = 300
    WORKER_CONCURRENCY: int = 10

settings = Settings()
