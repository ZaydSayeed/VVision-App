"""
Security module — validates Supabase JWT tokens.

The frontend handles auth via Supabase JS. The backend receives the
Supabase access_token as a Bearer header and validates it by calling
Supabase's /auth/v1/user endpoint.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

bearer_scheme = HTTPBearer()

# Cache to avoid hitting Supabase on every request (simple in-memory)
_user_cache: dict[str, dict] = {}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    Dependency that validates a Supabase access token and returns the user ID.

    Calls Supabase /auth/v1/user to validate the token and get user info.
    """
    token = credentials.credentials

    # Check cache first (tokens are valid for ~1 hour)
    if token in _user_cache:
        return _user_cache[token]

    import httpx

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
                timeout=5.0,
            )

        if res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        user_data = res.json()
        user_id = user_data.get("id", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

        # Cache this token → user_id mapping
        _user_cache[token] = user_id

        # Keep cache from growing forever
        if len(_user_cache) > 1000:
            _user_cache.clear()

        return user_id

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token",
        )
