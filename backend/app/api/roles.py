"""API endpoints za upravljanje rolama i permissionima."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit_log
from app.core.deps import get_current_active_user
from app.core.logging_config import correlation_id_var
from app.db.session import get_db
from app.models.user_models import Permission, Role, RolePermission, User

router = APIRouter(prefix="/roles")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RoleOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_system: bool = False
    permissions: list[str] = []

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    description: str | None = None


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class SetPermissionsRequest(BaseModel):
    permission_names: list[str]


class PermissionOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    module: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _role_to_out(role: Role) -> RoleOut:
    perms: list[str] = []
    try:
        perms = [p.name for p in role.permissions] if role.permissions else []
    except Exception:
        perms = []
    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=perms,
    )


# ---------------------------------------------------------------------------
# Endpoints  (IMPORTANT: static paths before /{role_id} to avoid conflicts)
# ---------------------------------------------------------------------------

@router.get("/permissions/all", response_model=list[PermissionOut])
def list_all_permissions(db: Session = Depends(get_db)) -> list[PermissionOut]:
    return db.execute(select(Permission).order_by(Permission.module, Permission.name)).scalars().all()


@router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db)) -> list[RoleOut]:
    roles = db.execute(select(Role).order_by(Role.name)).unique().scalars().all()
    return [_role_to_out(r) for r in roles]


@router.get("/{role_id}", response_model=RoleOut)
def get_role(role_id: int, db: Session = Depends(get_db)) -> RoleOut:
    role = db.execute(select(Role).where(Role.id == role_id)).unique().scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rola nije pronađena.")
    return _role_to_out(role)


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate, request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RoleOut:
    existing = db.execute(select(Role).where(Role.name == payload.name)).unique().scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Rola s tim imenom već postoji.")
    role = Role(name=payload.name, description=payload.description)
    db.add(role)
    db.flush()
    audit_log(
        db, current_user, "CREATE", "Role", str(role.id),
        new_values={"name": role.name, "description": role.description},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(role)
    return _role_to_out(role)


@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int, payload: RoleUpdate, request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RoleOut:
    role = db.execute(select(Role).where(Role.id == role_id)).unique().scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rola nije pronađena.")
    if role.is_system and payload.name and payload.name != role.name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sistemska rola se ne može preimenovati.")
    old_vals = {"name": role.name, "description": role.description}
    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    audit_log(
        db, current_user, "UPDATE", "Role", str(role.id),
        old_values=old_vals,
        new_values={"name": role.name, "description": role.description},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(role)
    return _role_to_out(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int, request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    role = db.execute(select(Role).where(Role.id == role_id)).unique().scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rola nije pronađena.")
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sistemska rola se ne može obrisati.")
    audit_log(
        db, current_user, "DELETE", "Role", str(role.id),
        old_values={"name": role.name},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.delete(role)
    db.commit()


@router.put("/{role_id}/permissions", response_model=RoleOut)
def set_role_permissions(
    role_id: int, payload: SetPermissionsRequest, request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RoleOut:
    role = db.execute(select(Role).where(Role.id == role_id)).unique().scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rola nije pronađena.")

    db.execute(
        RolePermission.__table__.delete().where(RolePermission.role_id == role_id)
    )

    for pname in payload.permission_names:
        perm = db.execute(select(Permission).where(Permission.name == pname)).scalar_one_or_none()
        if perm:
            db.add(RolePermission(role_id=role_id, permission_id=perm.id))

    audit_log(
        db, current_user, "SET_PERMISSIONS", "Role", str(role.id),
        new_values={"permissions": payload.permission_names},
        ip_address=request.client.host if request.client else None,
        correlation_id=correlation_id_var.get(None),
    )
    db.commit()
    db.refresh(role)
    return _role_to_out(role)
