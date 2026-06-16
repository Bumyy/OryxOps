from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "mysql+aiomysql://root:@localhost:3306/u848011415_qatari"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 10080

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
