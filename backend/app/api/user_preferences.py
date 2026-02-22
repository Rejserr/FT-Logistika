from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.models.user_models import User, UserPreference

router = APIRouter(prefix="/user-preferences")


class PrefOut(BaseModel):
    pref_key: str
    pref_value: str

    class Config:
        from_attributes = True


class PrefIn(BaseModel):
    pref_value: str


@router.get("", response_model=list[PrefOut])
def list_preferences(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    rows = db.query(UserPreference).filter(UserPreference.user_id == user.id).all()
    return rows


@router.get("/{pref_key}", response_model=PrefOut | None)
def get_preference(
    pref_key: str,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user.id, UserPreference.pref_key == pref_key)
        .first()
    )
    return row


@router.put("/{pref_key}", response_model=PrefOut)
def upsert_preference(
    pref_key: str,
    body: PrefIn,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user.id, UserPreference.pref_key == pref_key)
        .first()
    )
    if row:
        row.pref_value = body.pref_value
    else:
        row = UserPreference(user_id=user.id, pref_key=pref_key, pref_value=body.pref_value)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("", response_model=list[PrefOut])
def bulk_upsert_preferences(
    prefs: list[PrefOut],
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    results = []
    for p in prefs:
        row = (
            db.query(UserPreference)
            .filter(UserPreference.user_id == user.id, UserPreference.pref_key == p.pref_key)
            .first()
        )
        if row:
            row.pref_value = p.pref_value
        else:
            row = UserPreference(user_id=user.id, pref_key=p.pref_key, pref_value=p.pref_value)
            db.add(row)
        results.append(row)
    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.delete("/{pref_key}")
def delete_preference(
    pref_key: str,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user.id, UserPreference.pref_key == pref_key)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}
