from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user
from app.core.warehouse_scope import is_admin
from app.db.session import get_db
from app.models.user_models import User
from app.models.vehicle_models import Vozilo, VoziloTip, Vozac
from app.schemas.vehicles import (
    VozacCreate,
    VozacOut,
    VozacUpdate,
    VoziloCreate,
    VoziloOut,
    VoziloTipCreate,
    VoziloTipOut,
    VoziloTipUpdate,
    VoziloUpdate,
)

router = APIRouter()


@router.get("/vehicle-types", response_model=list[VoziloTipOut])
def list_vehicle_types(db: Session = Depends(get_db)) -> list[VoziloTipOut]:
    return db.execute(select(VoziloTip).order_by(VoziloTip.naziv)).scalars().all()


@router.post("/vehicle-types", response_model=VoziloTipOut, status_code=status.HTTP_201_CREATED)
def create_vehicle_type(payload: VoziloTipCreate, db: Session = Depends(get_db)) -> VoziloTipOut:
    vehicle_type = VoziloTip(**payload.model_dump())
    db.add(vehicle_type)
    db.commit()
    db.refresh(vehicle_type)
    return vehicle_type


@router.put("/vehicle-types/{type_id}", response_model=VoziloTipOut)
def update_vehicle_type(
    type_id: int, payload: VoziloTipUpdate, db: Session = Depends(get_db)
) -> VoziloTipOut:
    vehicle_type = db.get(VoziloTip, type_id)
    if not vehicle_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tip vozila nije pronađen."
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle_type, field, value)
    db.commit()
    db.refresh(vehicle_type)
    return vehicle_type


@router.delete("/vehicle-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle_type(type_id: int, db: Session = Depends(get_db)) -> None:
    vehicle_type = db.get(VoziloTip, type_id)
    if not vehicle_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tip vozila nije pronađen."
        )
    db.delete(vehicle_type)
    db.commit()


@router.get("/vehicles", response_model=list[VoziloOut])
def list_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[VoziloOut]:
    query = select(Vozilo).order_by(Vozilo.id.desc())
    if not is_admin(current_user) and current_user.warehouse_id:
        query = query.where(Vozilo.warehouse_id == current_user.warehouse_id)
    return db.execute(query).scalars().all()


@router.post("/vehicles", response_model=VoziloOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VoziloCreate, db: Session = Depends(get_db)) -> VoziloOut:
    vehicle = Vozilo(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.put("/vehicles/{vehicle_id}", response_model=VoziloOut)
def update_vehicle(
    vehicle_id: int, payload: VoziloUpdate, db: Session = Depends(get_db)
) -> VoziloOut:
    vehicle = db.get(Vozilo, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vozilo nije pronađeno.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)) -> None:
    vehicle = db.get(Vozilo, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vozilo nije pronađeno.")
    db.delete(vehicle)
    db.commit()


@router.get("/drivers", response_model=list[VozacOut])
def list_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[VozacOut]:
    query = select(Vozac).order_by(Vozac.id.desc())
    if not is_admin(current_user) and current_user.warehouse_id:
        query = query.where(Vozac.warehouse_id == current_user.warehouse_id)
    return db.execute(query).scalars().all()


@router.post("/drivers", response_model=VozacOut, status_code=status.HTTP_201_CREATED)
def create_driver(payload: VozacCreate, db: Session = Depends(get_db)) -> VozacOut:
    driver = Vozac(**payload.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


@router.put("/drivers/{driver_id}", response_model=VozacOut)
def update_driver(driver_id: int, payload: VozacUpdate, db: Session = Depends(get_db)) -> VozacOut:
    driver = db.get(Vozac, driver_id)
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vozač nije pronađen.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(driver, field, value)
    db.commit()
    db.refresh(driver)
    return driver


@router.delete("/drivers/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(driver_id: int, db: Session = Depends(get_db)) -> None:
    driver = db.get(Vozac, driver_id)
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vozač nije pronađen.")
    db.delete(driver)
    db.commit()
