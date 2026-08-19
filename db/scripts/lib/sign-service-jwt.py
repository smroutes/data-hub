#!/usr/bin/env python3
"""Mints a short-lived service_role JWT signed with GOTRUE_JWT_SECRET, using
only the Python standard library (no PyJWT dependency needed on the box).
Used by the admin scripts to authenticate against GoTrue's /admin/* API.

Usage: sign-service-jwt.py <secret> [ttl_seconds]
"""
import base64
import hashlib
import hmac
import json
import sys
import time


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: sign-service-jwt.py <secret> [ttl_seconds]", file=sys.stderr)
        sys.exit(1)

    secret = sys.argv[1]
    ttl = int(sys.argv[2]) if len(sys.argv) > 2 else 300

    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"role": "service_role", "iat": now, "exp": now + ttl}

    signing_input = f"{b64url(json.dumps(header).encode())}.{b64url(json.dumps(payload).encode())}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    print(f"{signing_input}.{b64url(signature)}")


if __name__ == "__main__":
    main()
