import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt as pyjwt

from app.core.config import settings

ALGORITHM = "HS256"


def verify_password(plain_password: str, stored_password: str) -> bool:
    if stored_password.startswith(("$2b$", "$2a$", "$2y$")):
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                stored_password.encode("utf-8"),
            )
        except ValueError:
            return False

    if len(stored_password) == 32 and all(c in "0123456789abcdef" for c in stored_password.lower()):
        return hashlib.md5(plain_password.encode()).hexdigest() == stored_password.lower()

    return plain_password == stored_password


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return pyjwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return pyjwt.decode(token, settings.secret_key, algorithms=[ALGORITHM], leeway=60)
    except pyjwt.PyJWTError:
        return None
