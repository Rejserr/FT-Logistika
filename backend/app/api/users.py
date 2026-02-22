"""API endpoints za upravljanje korisnicima (Admin only)."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit_log
from app.core.deps import require_permission
from app.core.logging_config import correlation_id_var
from app.core.security import hash_password
from app.core.warehouse_scope import is_admin
from app.db.session import get_db
from app.models.user_models import Role, User

router = APIRouter(prefix="/users")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserOut(BaseModel):
    id: int
    username: str
    ime: str | None = None
    prezime: str | None = None
    email: str | None = None
    full_name: str = ""
    aktivan: bool = True
    locked: bool = False
    role_id: int | None = None
    role_name: str | None = None
    warehouse_id: int | None = None
    vozac_id: int | None = None
    force_password_change: bool = False
    failed_login_attempts: int = 0
    last_login: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    ime: str | None = None
    prezime: str | None = None
    email: str | None = None
    role_id: int | None = None
    warehouse_id: int | None = None
    vozac_id: int | None = None
    force_password_change: bool = True


class UserUpdate(BaseModel):
    ime: str | None = None
    prezime: str | None = None
    email: str | None = None
    role_id: int | None = None
    warehouse_id: int | None = None
    vozac_id: int | None = None
    aktivan: bool | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_to_out(u: User) -> UserOut:
    role_name = None
    try:
        role_name = u.role.name if u.role else None
    except Exception:
        pass
    return UserOut(
        id=u.id,
        username=u.username,
        ime=u.ime,
        prezime=u.prezime,
        email=u.email,
        full_name=u.full_name,
        aktivan=u.aktivan,
        locked=u.locked or False,
        role_id=u.role_id,
        role_name=role_name,
        warehouse_id=u.warehouse_id,
        vozac_id=u.vozac_id,
        force_password_change=u.force_password_change or False,
        failed_login_attempts=u.failed_login_attempts or 0,
        last_login=str(u.last_login) if u.last_login else None,
        created_at=str(u.created_at) if u.created_at else None,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
) -> list[UserOut]:
    query = select(User).order_by(User.username)
    if not is_admin(current_user) and current_user.warehouse_id:
        query = query.where(User.warehouse_id == current_user.warehouse_id)
    users = db.execute(query).unique().scalars().all()
    return [_user_to_out(u) for u in users]


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("users.view")),
) -> UserOut:
    u = db.execute(select(User).where(User.id == user_id)).unique().scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Korisnik nije pronađen.")
    return _user_to_out(u)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.create")),
) -> UserOut:
    existing = db.execute(select(User).where(User.username == payload.username)).unique().scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Korisničko ime već postoji.")

    if len(payload.password) < 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lozinka mora imati najmanje 5 znakova.")

    if payload.role_id:
        role = db.execute(select(Role).where(Role.id == payload.role_id)).unique().scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rola nije pronađena.")

    if not is_admin(current_user) and current_user.warehouse_id:
        if payload.warehouse_id and payload.warehouse_id != current_user.warehouse_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Možete kreirati korisnika samo za svoje skladište.",
            )
        payload.warehouse_id = current_user.warehouse_id

    u = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        ime=payload.ime,
        prezime=payload.prezime,
        email=payload.email,
        role_id=payload.role_id,
        warehouse_id=payload.warehouse_id,
        vozac_id=payload.vozac_id,
        force_password_change=payload.force_password_change,
    )
    db.add(u)
    db.flush()

    audit_log(
        db, current_user, "CREATE", "User", str(u.id),
        new_values={"username": u.username, "role_id": u.role_id, "warehouse_id": u.warehouse_id},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(u)
    return _user_to_out(u)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.edit")),
) -> UserOut:
    u = db.execute(select(User).where(User.id == user_id)).unique().scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Korisnik nije pronađen.")

    data = payload.model_dump(exclude_unset=True)
    if "role_id" in data and data["role_id"] is not None:
        role = db.execute(select(Role).where(Role.id == data["role_id"])).unique().scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rola nije pronađena.")

    old_vals = {k: getattr(u, k) for k in data}
    for field, value in data.items():
        setattr(u, field, value)

    audit_log(
        db, current_user, "UPDATE", "User", str(u.id),
        old_values=old_vals, new_values=data,
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(u)
    return _user_to_out(u)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.delete")),
) -> None:
    u = db.execute(select(User).where(User.id == user_id)).unique().scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Korisnik nije pronađen.")
    if u.username == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin korisnik se ne može deaktivirati.")
    u.aktivan = False
    audit_log(
        db, current_user, "DEACTIVATE", "User", str(u.id),
        new_values={"aktivan": False},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: int,
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.edit")),
) -> UserOut:
    u = db.execute(select(User).where(User.id == user_id)).unique().scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Korisnik nije pronađen.")
    if len(payload.new_password) < 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lozinka mora imati najmanje 5 znakova.")
    u.password_hash = hash_password(payload.new_password)
    u.force_password_change = True
    u.failed_login_attempts = 0
    audit_log(
        db, current_user, "RESET_PASSWORD", "User", str(u.id),
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(u)
    return _user_to_out(u)


@router.put("/{user_id}/lock", response_model=UserOut)
def lock_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.edit")),
) -> UserOut:
    u = db.execute(select(User).where(User.id == user_id)).unique().scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Korisnik nije pronađen.")
    u.locked = True
    audit_log(
        db, current_user, "LOCK", "User", str(u.id),
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(u)
    return _user_to_out(u)


@router.put("/{user_id}/unlock", response_model=UserOut)
def unlock_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.edit")),
) -> UserOut:
    u = db.execute(select(User).where(User.id == user_id)).unique().scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Korisnik nije pronađen.")
    u.locked = False
    u.failed_login_attempts = 0
    audit_log(
        db, current_user, "UNLOCK", "User", str(u.id),
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(u)
    return _user_to_out(u)
