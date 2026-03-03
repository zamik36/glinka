from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BOT_TOKEN: str
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/homework_db"
    DEBUG: bool = False
    ALLOWED_ORIGIN: str = "*"
    FILE_STORAGE_DIR: str = "./uploads"

    class Config:
        env_file = ".env"

settings = Settings()
