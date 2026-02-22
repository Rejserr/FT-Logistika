import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.erp_models import Artikl, ArtiklKriterija, GrupaArtikla, KriterijaSku
from app.schemas.items import (
    ArtiklKriterijaCreate,
    ArtiklKriterijaImportResponse,
    ArtiklKriterijaOut,
    ArtiklOut,
    GrupaArtiklaOut,
    KriterijaSkuCreate,
    KriterijaSkuOut,
    KriterijaSkuUpdate,
)
from app.services.artikl_kriterija_import_service import import_artikl_kriterija_from_xlsx

router = APIRouter()


# ==============================================================================
# Artikli (postojeći)
# ==============================================================================


@router.get("/artikli", response_model=list[ArtiklOut])
def list_artikli(
    search: str | None = Query(default=None),
    grupa_uid: str | None = Query(default=None, alias="grupa_artikla_uid"),
    limit: int = Query(default=100, ge=1, le=50000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ArtiklOut]:
    query = select(Artikl)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Artikl.artikl.ilike(pattern)) | (Artikl.naziv.ilike(pattern))
        )
    if grupa_uid:
        query = query.where(Artikl.grupa_artikla_uid == grupa_uid)
    query = query.order_by(Artikl.artikl).offset(offset).limit(limit)
    return db.execute(query).scalars().all()


@router.get("/grupe-artikala", response_model=list[GrupaArtiklaOut])
def list_grupe_artikala(
    db: Session = Depends(get_db),
) -> list[GrupaArtiklaOut]:
    query = select(GrupaArtikla).order_by(GrupaArtikla.grupa_artikla)
    return db.execute(query).scalars().all()


# ==============================================================================
# Kriterije SKU (lookup)
# ==============================================================================


@router.get("/kriterije-sku", response_model=list[KriterijaSkuOut])
def list_kriterije_sku(db: Session = Depends(get_db)):
    return db.execute(select(KriterijaSku).order_by(KriterijaSku.naziv)).scalars().all()


@router.post("/kriterije-sku", response_model=KriterijaSkuOut, status_code=201)
def create_kriterija_sku(data: KriterijaSkuCreate, db: Session = Depends(get_db)):
    obj = KriterijaSku(naziv=data.naziv, opis=data.opis)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/kriterije-sku/{kriterija_id}", response_model=KriterijaSkuOut)
def update_kriterija_sku(
    kriterija_id: int,
    data: KriterijaSkuUpdate,
    db: Session = Depends(get_db),
):
    obj = db.get(KriterijaSku, kriterija_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Kriterij nije pronađen.")
    if data.naziv is not None:
        obj.naziv = data.naziv
    if data.opis is not None:
        obj.opis = data.opis
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/kriterije-sku/{kriterija_id}", status_code=204)
def delete_kriterija_sku(kriterija_id: int, db: Session = Depends(get_db)):
    obj = db.get(KriterijaSku, kriterija_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Kriterij nije pronađen.")
    # Check if any artikli_kriterija reference this
    count = db.execute(
        select(ArtiklKriterija).where(ArtiklKriterija.kriterija_id == kriterija_id)
    ).scalars().first()
    if count:
        raise HTTPException(
            status_code=400,
            detail="Nije moguće obrisati kriterij koji se koristi u artikl-kriterija vezama.",
        )
    db.delete(obj)
    db.commit()


# ==============================================================================
# Artikli Kriterija (veze)
# ==============================================================================


@router.get("/artikli-kriterija", response_model=list[ArtiklKriterijaOut])
def list_artikli_kriterija(db: Session = Depends(get_db)):
    return db.execute(
        select(ArtiklKriterija).order_by(ArtiklKriterija.artikl)
    ).scalars().all()


@router.post("/artikli-kriterija", response_model=ArtiklKriterijaOut, status_code=201)
def create_artikl_kriterija(data: ArtiklKriterijaCreate, db: Session = Depends(get_db)):
    # Verify kriterij exists
    kriterij = db.get(KriterijaSku, data.kriterija_id)
    if not kriterij:
        raise HTTPException(status_code=400, detail="Kriterij ne postoji.")

    # Lookup artikl naziv
    artikl_obj = db.execute(
        select(Artikl).where(Artikl.artikl == data.artikl)
    ).scalar_one_or_none()

    artikl_naziv = artikl_obj.naziv if artikl_obj else None

    # Check for duplicate
    existing = db.execute(
        select(ArtiklKriterija).where(
            ArtiklKriterija.artikl == data.artikl,
            ArtiklKriterija.kriterija_id == data.kriterija_id,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Ova veza artikl-kriterij već postoji.")

    obj = ArtiklKriterija(
        artikl=data.artikl,
        artikl_naziv=artikl_naziv,
        kriterija_id=data.kriterija_id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/artikli-kriterija/{ak_id}", status_code=204)
def delete_artikl_kriterija(ak_id: int, db: Session = Depends(get_db)):
    obj = db.get(ArtiklKriterija, ak_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Artikl-kriterija veza nije pronađena.")
    db.delete(obj)
    db.commit()


@router.post("/artikli-kriterija/import", response_model=ArtiklKriterijaImportResponse)
async def import_artikli_kriterija(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Samo XLSX datoteke su podržane.")

    content = await file.read()
    result = import_artikl_kriterija_from_xlsx(content, db)
    return result


@router.get("/artikli-kriterija/artikl-sifre", response_model=list[str])
def get_artikl_sifre_with_criteria(db: Session = Depends(get_db)):
    """Vraća listu šifri artikala koji imaju barem jedan kriterij (za frontend highlight)."""
    rows = db.execute(select(ArtiklKriterija.artikl).distinct()).scalars().all()
    return list(rows)


@router.get("/artikli-kriterija/example-xlsx")
def download_example_xlsx():
    """Generira primjer XLSX datoteke za masovni import artikl-kriterija."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Artikli kriterija"

    # Header
    ws.append(["artikl", "kriterija"])

    # Primjeri
    ws.append(["12345", "Raster"])
    ws.append(["67890", "Raster"])
    ws.append(["11111", "Raster"])

    # Širine kolona
    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 20

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=artikli_kriterija_primjer.xlsx"},
    )

