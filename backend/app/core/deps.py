"""FastAPI dependencies for authentication and authorization."""

from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user_models import User


def _extract_token(request: Request) -> str | None:
    """Extract JWT from httpOnly cookie or Authorization header."""
    token = request.cookies.get("access_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Dependency — returns the authenticated User or raises 401."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Niste prijavljeni.",
        )
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token je nevažeći ili je istekao.",
        )
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Korisnik nije pronađen.",
        )
    return user


def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    """Ensures the user is active and not locked."""
    if not user.aktivan:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Korisnički račun je deaktiviran.",
        )
    if user.locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Korisnički račun je zaključan.",
        )
    return user


def require_permission(permission_name: str) -> Callable:
    """Factory — returns a dependency that verifies the user has a specific permission."""

    def _check(
        request: Request,
        user: User = Depends(get_current_active_user),
    ) -> User:
        if user.role and user.role.name == "Admin":
            return user

        token = _extract_token(request)
        payload = decode_token(token) if token else None
        perms: list[str] = (payload or {}).get("perms", [])

        if permission_name not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Nemate dozvolu: {permission_name}",
            )
        return user

    return _check
