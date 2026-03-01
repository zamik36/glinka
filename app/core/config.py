from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BOT_TOKEN: str
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/homework_db"
    SECRET_KEY: str = "super_secret"
    DEBUG: bool = False

    class Config:
        env_file = ".env"

settings = Settings()