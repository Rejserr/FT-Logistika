"""Authentication endpoints — login, logout, token refresh, current user info."""

import hashlib
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.audit import audit_log
from app.core.config import settings
from app.core.logging_config import correlation_id_var
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.deps import get_current_active_user
from app.db.session import get_db
from app.models.user_models import User, RefreshToken

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserMeResponse(BaseModel):
    id: int
    username: str
    ime: str | None = None
    prezime: str | None = None
    email: str | None = None
    full_name: str
    role: str | None = None
    warehouse_id: int | None = None
    permissions: list[str] = []
    force_password_change: bool = False

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_user_permissions(user: User) -> list[str]:
    if user.role is None:
        return []
    return [p.name for p in user.role.permissions]


def _set_auth_cookies(response: Response, access: str, refresh: str, remember: bool) -> None:
    max_age_refresh = settings.REMEMBER_ME_EXPIRE_DAYS * 86400 if remember else settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    response.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=max_age_refresh,
        path="/api/auth",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _validate_password(password: str) -> None:
    """Enforce password policy: min 5 chars."""
    if len(password) < 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lozinka mora imati najmanje 5 znakova.")


def _check_brute_force(user: User) -> None:
    if user.failed_login_attempts >= settings.LOGIN_MAX_ATTEMPTS:
        if user.last_login and (
            datetime.now(timezone.utc) - user.last_login.replace(tzinfo=timezone.utc)
            < timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
        ):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Previše neuspješnih pokušaja. Pokušajte za {settings.LOGIN_LOCKOUT_MINUTES} minuta.",
            )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Pogrešno korisničko ime ili lozinka.")

    _check_brute_force(user)

    if not verify_password(body.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Pogrešno korisničko ime ili lozinka.")

    if not user.aktivan:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Korisnički račun je deaktiviran.")
    if user.locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Korisnički račun je zaključan.")

    perms = _get_user_permissions(user)
    role_name = user.role.name if user.role else "Viewer"

    access = create_access_token(user.id, role_name, user.warehouse_id, perms)
    refresh = create_refresh_token(user.id, body.remember_me)

    expires_days = settings.REMEMBER_ME_EXPIRE_DAYS if body.remember_me else settings.REFRESH_TOKEN_EXPIRE_DAYS
    rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
        user_agent=request.headers.get("User-Agent", "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    db.add(rt)

    user.failed_login_attempts = 0
    user.last_login = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None
    db.commit()

    _set_auth_cookies(response, access, refresh, body.remember_me)

    audit_log(
        db, user, "LOGIN", "User", str(user.id),
        new_values={"ip": rt.ip_address, "remember_me": body.remember_me},
        ip_address=rt.ip_address,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    logger.info("Login: user=%s ip=%s", user.username, rt.ip_address)

    return {
        "message": "Uspješna prijava.",
        "user": UserMeResponse(
            id=user.id,
            username=user.username,
            ime=user.ime,
            prezime=user.prezime,
            email=user.email,
            full_name=user.full_name,
            role=role_name,
            warehouse_id=user.warehouse_id,
            permissions=perms,
            force_password_change=user.force_password_change,
        ).model_dump(),
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_cookie = request.cookies.get("refresh_token")
    if refresh_cookie:
        token_hash = _hash_token(refresh_cookie)
        existing = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
        if existing:
            existing.revoked = True
            db.commit()

    _clear_auth_cookies(response)

    token = request.cookies.get("access_token")
    if token:
        payload = decode_token(token)
        if payload:
            uid = int(payload.get("sub", 0))
            user_obj = db.query(User).filter(User.id == uid).first()
            if user_obj:
                audit_log(
                    db, user_obj, "LOGOUT", "User", str(uid),
                    ip_address=request.client.host if request.client else None,
                    correlation_id=correlation_id_var.get(None),
                )
                db.commit()

    return {"message": "Uspješna odjava."}


@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_cookie = request.cookies.get("refresh_token")
    if not refresh_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token nije pronađen.")

    payload = decode_token(refresh_cookie)
    if payload is None or payload.get("type") != "refresh":
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token je nevažeći.")

    token_hash = _hash_token(refresh_cookie)
    stored = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,  # noqa: E712
    ).first()
    if stored is None:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token je povučen.")

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.aktivan or user.locked:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Korisnik nije dostupan.")

    perms = _get_user_permissions(user)
    role_name = user.role.name if user.role else "Viewer"
    new_access = create_access_token(user.id, role_name, user.warehouse_id, perms)

    response.set_cookie(
        key="access_token",
        value=new_access,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return {"message": "Token osvježen."}


@router.get("/me", response_model=UserMeResponse)
def get_me(user: User = Depends(get_current_active_user)):
    perms = _get_user_permissions(user)
    role_name = user.role.name if user.role else "Viewer"
    return UserMeResponse(
        id=user.id,
        username=user.username,
        ime=user.ime,
        prezime=user.prezime,
        email=user.email,
        full_name=user.full_name,
        role=role_name,
        warehouse_id=user.warehouse_id,
        permissions=perms,
        force_password_change=user.force_password_change,
    )


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trenutna lozinka je netočna.")

    _validate_password(body.new_password)

    user.password_hash = hash_password(body.new_password)
    user.force_password_change = False
    audit_log(
        db, user, "CHANGE_PASSWORD", "User", str(user.id),
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    return {"message": "Lozinka je uspješno promijenjena."}
