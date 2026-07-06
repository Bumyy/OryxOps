from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "mysql+aiomysql://root:@localhost:3306/u848011415_qatari"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 10080
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,https://live.qatarivirtual.xyz"

    if_api_base_url: str = "https://api.infiniteflight.com/public/v3"
    if_auth_base_url: str = "https://api.infiniteflight.com/auth/v2"
    if_client_id: str = ""
    if_client_secret: str = ""
    if_redirect_uri: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
