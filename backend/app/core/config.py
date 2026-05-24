import os
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    app_name: str = "LabOS v3"
    secret_key: str = ""  # Must be set via environment variable
    algorithm: str = "HS256"
    database_url: str = "sqlite:///./lab.db"
    upload_dir: str = "./uploads"
    scheduler_interval_seconds: int = 60
    access_token_expire_minutes: int = 120  # Reduced from 480 to 2 hours
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    environment: str = "development"  # "development" | "production"

    # Security settings
    min_password_length: int = 8
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 15
    allowed_file_types: list[str] = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".csv"]
    max_file_size_mb: int = 10

    # Email / SMTP (optional — leave blank to disable email delivery)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "labos@lab.local"
    smtp_tls: bool = True

    # AI — priority order: Claude → DeepSeek → OpenAI → built-in rules
    # Set whichever key(s) you have. First available key wins.
    anthropic_api_key: str = ""
    deepseek_api_key: str = ""   # DEEPSEEK_API_KEY — deepseek-chat model
    openai_api_key: str = ""

    # IoT / MQTT (optional — leave blank to disable MQTT relay)
    mqtt_broker_host: str = ""
    mqtt_broker_port: int = 1883
    mqtt_topic: str = "lab/sensors/#"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith('['):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [o.strip() for o in v.split(',') if o.strip()]
        return v

    @field_validator('secret_key', mode='before')
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or v in ["fallback-dev-key", "supersecret-lab-key-change-in-production", ""]:
            # Generate a secure random key for development
            generated_key = secrets.token_urlsafe(32)
            print(f"WARNING: No secure SECRET_KEY found. Generated temporary key for development.")
            print(f"For production, set SECRET_KEY environment variable to a secure random value.")
            return generated_key
        if len(v) < 32:
            print("WARNING: SECRET_KEY should be at least 32 characters for security.")
        return v


settings = Settings()
