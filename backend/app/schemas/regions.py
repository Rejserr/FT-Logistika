from __future__ import annotations

from pydantic import BaseModel, ConfigDict


# ==============================================================================
# Regija
# ==============================================================================


class RegijaBase(BaseModel):
    naziv: str
    opis: str | None = None
    parent_id: int | None = None
    aktivan: bool = True


class RegijaCreate(RegijaBase):
    pass


class RegijaUpdate(BaseModel):
    naziv: str | None = None
    opis: str | None = None
    parent_id: int | None = None
    aktivan: bool | None = None


class RegijaOut(RegijaBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class RegijaTreeOut(RegijaOut):
    """Regija s ugniježđenim podregijama (za tree prikaz)."""
    children: list[RegijaTreeOut] = []
    postal_count: int = 0


# ==============================================================================
# Poštanski broj
# ==============================================================================


class PostanskiBrojBase(BaseModel):
    postanski_broj: str
    naziv_mjesta: str = ""
    regija_id: int | None = None


class PostanskiBrojCreate(PostanskiBrojBase):
    pass


class PostanskiBrojUpdate(BaseModel):
    postanski_broj: str | None = None
    naziv_mjesta: str | None = None
    regija_id: int | None = None


class PostanskiBrojOut(PostanskiBrojBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Bulk reassign
# ==============================================================================


class BulkReassignRequest(BaseModel):
    """Zahtjev za bulk prebacivanje poštanskih brojeva u drugu regiju."""
    postal_code_ids: list[int]
    target_regija_id: int


class BulkReassignResponse(BaseModel):
    """Odgovor na bulk reassign."""
    updated_postal_codes: int
    updated_orders: int
