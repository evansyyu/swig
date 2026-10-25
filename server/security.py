"""Password hashing (scrypt, stdlib) and app tokens (JWT)."""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

INSECURE_SECRET = "dev-insecure-secret-set-JWT_SECRET-in-production"
JWT_SECRET = os.environ.get("JWT_SECRET", INSECURE_SECRET)
TOKEN_DAYS = 90
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password, stored):
    try:
        _, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
    return hmac.compare_digest(digest.hex(), digest_hex)


def create_token(user_id):
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        return None
