"""
Config API endpointi.

CRUD za settings i prioritete.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.config_models import Prioritet, Setting, Status
from app.schemas.config import (
    PrioritetCreate,
    PrioritetOut,
    PrioritetUpdate,
    SettingCreate,
    SettingOut,
    SettingsBulkUpdate,
    SettingUpdate,
    StatusCreate,
    StatusOut,
    StatusUpdate,
)

router = APIRouter()


# ==============================================================================
# Settings CRUD
# ==============================================================================


@router.get("/settings", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db)) -> list[SettingOut]:
    """Lista svih postavki."""
    settings = db.execute(select(Setting).order_by(Setting.key)).scalars().all()
    return [SettingOut.model_validate(s) for s in settings]


@router.get("/settings/{key}", response_model=SettingOut)
def get_setting(key: str, db: Session = Depends(get_db)) -> SettingOut:
    """Dohvati pojedinačnu postavku."""
    setting = db.get(Setting, key)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Postavka nije pronađena."
        )
    return SettingOut.model_validate(setting)


@router.post("/settings", response_model=SettingOut, status_code=status.HTTP_201_CREATED)
def create_setting(payload: SettingCreate, db: Session = Depends(get_db)) -> SettingOut:
    """Kreiraj novu postavku."""
    existing = db.get(Setting, payload.key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Postavka s ključem '{payload.key}' već postoji.",
        )

    setting = Setting(key=payload.key, value=payload.value)
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return SettingOut.model_validate(setting)


@router.put("/settings/{key}", response_model=SettingOut)
def update_setting(
    key: str, payload: SettingUpdate, db: Session = Depends(get_db)
) -> SettingOut:
    """Ažuriraj postavku."""
    setting = db.get(Setting, key)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Postavka nije pronađena."
        )

    if payload.value is not None:
        setting.value = payload.value

    db.commit()
    db.refresh(setting)
    return SettingOut.model_validate(setting)


@router.put("/settings", response_model=list[SettingOut])
def bulk_update_settings(
    payload: SettingsBulkUpdate, db: Session = Depends(get_db)
) -> list[SettingOut]:
    """Bulk update postavki. Kreira nepostojeće."""
    updated = []
    for key, value in payload.settings.items():
        setting = db.get(Setting, key)
        if setting:
            setting.value = value
        else:
            setting = Setting(key=key, value=value)
            db.add(setting)
        updated.append(setting)

    db.commit()

    # Refresh i vrati
    result = []
    for s in updated:
        db.refresh(s)
        result.append(SettingOut.model_validate(s))
    return result


@router.delete("/settings/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(key: str, db: Session = Depends(get_db)) -> None:
    """Obriši postavku."""
    setting = db.get(Setting, key)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Postavka nije pronađena."
        )
    db.delete(setting)
    db.commit()


# ==============================================================================
# Prioriteti CRUD
# ==============================================================================


@router.get("/prioriteti", response_model=list[PrioritetOut])
def list_prioriteti(db: Session = Depends(get_db)) -> list[PrioritetOut]:
    """Lista svih prioriteta."""
    prioriteti = db.execute(
        select(Prioritet).order_by(Prioritet.tezina.desc())
    ).scalars().all()
    return [PrioritetOut.model_validate(p) for p in prioriteti]


@router.get("/prioriteti/{prioritet_id}", response_model=PrioritetOut)
def get_prioritet(prioritet_id: int, db: Session = Depends(get_db)) -> PrioritetOut:
    """Dohvati prioritet."""
    prioritet = db.get(Prioritet, prioritet_id)
    if not prioritet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prioritet nije pronađen."
        )
    return PrioritetOut.model_validate(prioritet)


@router.post("/prioriteti", response_model=PrioritetOut, status_code=status.HTTP_201_CREATED)
def create_prioritet(
    payload: PrioritetCreate, db: Session = Depends(get_db)
) -> PrioritetOut:
    """Kreiraj novi prioritet."""
    prioritet = Prioritet(
        naziv=payload.naziv,
        tezina=payload.tezina,
        aktivan=payload.aktivan,
    )
    db.add(prioritet)
    db.commit()
    db.refresh(prioritet)
    return PrioritetOut.model_validate(prioritet)


@router.put("/prioriteti/{prioritet_id}", response_model=PrioritetOut)
def update_prioritet(
    prioritet_id: int, payload: PrioritetUpdate, db: Session = Depends(get_db)
) -> PrioritetOut:
    """Ažuriraj prioritet."""
    prioritet = db.get(Prioritet, prioritet_id)
    if not prioritet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prioritet nije pronađen."
        )

    if payload.naziv is not None:
        prioritet.naziv = payload.naziv
    if payload.tezina is not None:
        prioritet.tezina = payload.tezina
    if payload.aktivan is not None:
        prioritet.aktivan = payload.aktivan

    db.commit()
    db.refresh(prioritet)
    return PrioritetOut.model_validate(prioritet)


@router.delete("/prioriteti/{prioritet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prioritet(prioritet_id: int, db: Session = Depends(get_db)) -> None:
    """Obriši prioritet."""
    prioritet = db.get(Prioritet, prioritet_id)
    if not prioritet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prioritet nije pronađen."
        )
    db.delete(prioritet)
    db.commit()


# ==============================================================================
# Statusi CRUD
# ==============================================================================


@router.get("/statusi", response_model=list[StatusOut])
def list_statusi(db: Session = Depends(get_db)) -> list[StatusOut]:
    """Lista svih statusa."""
    statusi = db.execute(
        select(Status).order_by(Status.redoslijed)
    ).scalars().all()
    return [StatusOut.model_validate(s) for s in statusi]


@router.get("/statusi/{status_id}", response_model=StatusOut)
def get_status(status_id: str, db: Session = Depends(get_db)) -> StatusOut:
    """Dohvati status."""
    s = db.get(Status, status_id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Status nije pronađen."
        )
    return StatusOut.model_validate(s)


@router.post("/statusi", response_model=StatusOut, status_code=status.HTTP_201_CREATED)
def create_status(
    payload: StatusCreate, db: Session = Depends(get_db)
) -> StatusOut:
    """Kreiraj novi status."""
    existing = db.get(Status, payload.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Status s ID-jem '{payload.id}' već postoji.",
        )
    s = Status(
        id=payload.id,
        naziv=payload.naziv,
        opis=payload.opis,
        redoslijed=payload.redoslijed,
        aktivan=payload.aktivan,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return StatusOut.model_validate(s)


@router.put("/statusi/{status_id}", response_model=StatusOut)
def update_status_endpoint(
    status_id: str, payload: StatusUpdate, db: Session = Depends(get_db)
) -> StatusOut:
    """Ažuriraj status."""
    s = db.get(Status, status_id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Status nije pronađen."
        )
    if payload.naziv is not None:
        s.naziv = payload.naziv
    if payload.opis is not None:
        s.opis = payload.opis
    if payload.redoslijed is not None:
        s.redoslijed = payload.redoslijed
    if payload.aktivan is not None:
        s.aktivan = payload.aktivan
    db.commit()
    db.refresh(s)
    return StatusOut.model_validate(s)


@router.delete("/statusi/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_status_endpoint(status_id: str, db: Session = Depends(get_db)) -> None:
    """Obriši status."""
    s = db.get(Status, status_id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Status nije pronađen."
        )
    db.delete(s)
    db.commit()
