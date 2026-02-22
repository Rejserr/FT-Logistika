from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func as sa_func, select, update
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.regional_models import Regija, PostanskiBroj
from app.models.erp_models import NalogHeader, Partner
from app.schemas.regions import (
    BulkReassignRequest,
    BulkReassignResponse,
    RegijaCreate,
    RegijaOut,
    RegijaTreeOut,
    RegijaUpdate,
    PostanskiBrojCreate,
    PostanskiBrojOut,
    PostanskiBrojUpdate,
)
from app.services.region_import_service import import_regije_i_postanski

router = APIRouter()


# ==============================================================================
# Regije CRUD
# ==============================================================================


@router.get("/regions", response_model=list[RegijaOut])
def list_regions(db: Session = Depends(get_db)) -> list[RegijaOut]:
    return db.execute(select(Regija).order_by(Regija.naziv)).scalars().all()


@router.get("/regions/tree", response_model=list[RegijaTreeOut])
def get_regions_tree(db: Session = Depends(get_db)) -> list[RegijaTreeOut]:
    """Vraća regije u tree strukturi s brojem poštanskih brojeva po regiji."""
    all_regions = db.execute(select(Regija).order_by(Regija.naziv)).scalars().all()

    # Prebrojimo poštanske brojeve po regiji
    postal_counts_raw = db.execute(
        select(PostanskiBroj.regija_id, sa_func.count(PostanskiBroj.id))
        .where(PostanskiBroj.regija_id.isnot(None))
        .group_by(PostanskiBroj.regija_id)
    ).all()
    postal_counts: dict[int, int] = {row[0]: row[1] for row in postal_counts_raw}

    # Rekurzivno gradimo stablo
    region_map: dict[int, dict] = {}
    for r in all_regions:
        region_map[r.id] = {
            "id": r.id,
            "naziv": r.naziv,
            "opis": r.opis,
            "parent_id": r.parent_id,
            "aktivan": r.aktivan,
            "postal_count": postal_counts.get(r.id, 0),
            "children": [],
        }

    roots: list[dict] = []
    for r in all_regions:
        node = region_map[r.id]
        if r.parent_id and r.parent_id in region_map:
            region_map[r.parent_id]["children"].append(node)
        else:
            roots.append(node)

    return roots


@router.post("/regions", response_model=RegijaOut, status_code=status.HTTP_201_CREATED)
def create_region(payload: RegijaCreate, db: Session = Depends(get_db)) -> RegijaOut:
    # Provjeri da parent postoji (ako je zadan)
    if payload.parent_id is not None:
        parent = db.get(Regija, payload.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nadređena regija nije pronađena.",
            )
    regija = Regija(**payload.model_dump())
    db.add(regija)
    db.commit()
    db.refresh(regija)
    return regija


@router.put("/regions/{regija_id}", response_model=RegijaOut)
def update_region(
    regija_id: int, payload: RegijaUpdate, db: Session = Depends(get_db)
) -> RegijaOut:
    regija = db.get(Regija, regija_id)
    if not regija:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regija nije pronađena.")

    updated = payload.model_dump(exclude_unset=True)

    # Provjeri parent_id (ne smije biti sam sebi roditelj)
    if "parent_id" in updated:
        new_parent = updated["parent_id"]
        if new_parent is not None:
            if new_parent == regija_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Regija ne može biti sama sebi nadređena.",
                )
            parent = db.get(Regija, new_parent)
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nadređena regija nije pronađena.",
                )

    for field, value in updated.items():
        setattr(regija, field, value)
    db.commit()
    db.refresh(regija)
    return regija


@router.delete("/regions/{regija_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_region(regija_id: int, db: Session = Depends(get_db)) -> None:
    regija = db.get(Regija, regija_id)
    if not regija:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regija nije pronađena.")

    # Provjeri da nema podregija
    child_count = db.execute(
        select(sa_func.count(Regija.id)).where(Regija.parent_id == regija_id)
    ).scalar() or 0
    if child_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Regija ima {child_count} podregija. Prvo obriši podregije.",
        )

    # Provjeri da nema poštanskih brojeva
    pb_count = db.execute(
        select(sa_func.count(PostanskiBroj.id)).where(PostanskiBroj.regija_id == regija_id)
    ).scalar() or 0
    if pb_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Regija ima {pb_count} poštanskih brojeva. Prvo ih prebaci u drugu regiju.",
        )

    db.delete(regija)
    db.commit()


# ==============================================================================
# Poštanski brojevi CRUD
# ==============================================================================


@router.get("/postal-codes", response_model=list[PostanskiBrojOut])
def list_postal_codes(db: Session = Depends(get_db)) -> list[PostanskiBrojOut]:
    return db.execute(select(PostanskiBroj).order_by(PostanskiBroj.postanski_broj)).scalars().all()


@router.post("/postal-codes", response_model=PostanskiBrojOut, status_code=status.HTTP_201_CREATED)
def create_postal_code(
    payload: PostanskiBrojCreate, db: Session = Depends(get_db)
) -> PostanskiBrojOut:
    postal_code = PostanskiBroj(**payload.model_dump())
    db.add(postal_code)
    db.commit()
    db.refresh(postal_code)
    return postal_code


@router.put("/postal-codes/{postal_id}", response_model=PostanskiBrojOut)
def update_postal_code(
    postal_id: int, payload: PostanskiBrojUpdate, db: Session = Depends(get_db)
) -> PostanskiBrojOut:
    postal_code = db.get(PostanskiBroj, postal_id)
    if not postal_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Poštanski broj nije pronađen."
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(postal_code, field, value)
    db.commit()
    db.refresh(postal_code)
    return postal_code


@router.delete("/postal-codes/{postal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_postal_code(postal_id: int, db: Session = Depends(get_db)) -> None:
    postal_code = db.get(PostanskiBroj, postal_id)
    if not postal_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Poštanski broj nije pronađen."
        )
    db.delete(postal_code)
    db.commit()


# ==============================================================================
# Bulk reassign poštanskih brojeva
# ==============================================================================


@router.post("/postal-codes/bulk-reassign", response_model=BulkReassignResponse)
def bulk_reassign_postal_codes(
    payload: BulkReassignRequest, db: Session = Depends(get_db)
) -> BulkReassignResponse:
    """Prebaci odabrane poštanske brojeve u drugu regiju.
    Također ažurira regija_id na svim nalozima čiji partneri koriste te PB."""

    # Provjeri da ciljna regija postoji
    target = db.get(Regija, payload.target_regija_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciljna regija nije pronađena.",
        )

    # Dohvati PB koji se prebacuju
    postal_codes = db.execute(
        select(PostanskiBroj).where(PostanskiBroj.id.in_(payload.postal_code_ids))
    ).scalars().all()

    if not postal_codes:
        return BulkReassignResponse(updated_postal_codes=0, updated_orders=0)

    # Skupi poštanske brojeve (string) za ažuriranje naloga
    pb_strings = [pc.postanski_broj for pc in postal_codes]

    # Ažuriraj regija_id na poštanskim brojevima
    updated_pc = 0
    for pc in postal_codes:
        if pc.regija_id != payload.target_regija_id:
            pc.regija_id = payload.target_regija_id
            updated_pc += 1

    # Ažuriraj naloge - dohvati partnere s tim poštanskim brojevima
    partner_subq = (
        select(Partner.partner_uid)
        .where(Partner.postanski_broj.in_(pb_strings))
        .scalar_subquery()
    )

    updated_orders = db.execute(
        update(NalogHeader)
        .where(NalogHeader.partner_uid.in_(partner_subq))
        .values(regija_id=payload.target_regija_id)
    ).rowcount

    db.commit()

    return BulkReassignResponse(
        updated_postal_codes=updated_pc,
        updated_orders=updated_orders,
    )


# ==============================================================================
# Import regija i poštanskih brojeva (CSV / XLSX)
# ==============================================================================


@router.post("/regions/import")
def import_regions_file(
    file: UploadFile = File(..., description="CSV ili XLSX datoteka (kolone: Postanski_broj, Mjesto, regija)"),
    db: Session = Depends(get_db),
):
    """
    Uvezi regije i poštanske brojeve iz CSV ili XLSX.

    Očekivani format: prvi red = header, kolone Postanski_broj, Mjesto, regija.
    Separator u CSV može biti ; ili ,.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Naziv datoteke nije naveden.")

    content = file.file.read()
    try:
        result = import_regije_i_postanski(db, content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return result
