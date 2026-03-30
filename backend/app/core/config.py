from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = ""
    mongodb_db_name: str = "dvision"

    # Supabase (for token validation)
    supabase_url: str = "https://xqqihmzbbqztfrvsbsnx.supabase.co"
    supabase_anon_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
