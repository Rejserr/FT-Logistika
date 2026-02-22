from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GrupaArtiklaOut(BaseModel):
    grupa_artikla_uid: str
    grupa_artikla: str
    grupa_artikla_naziv: str | None = None
    nadgrupa_artikla: str | None = None
    nadgrupa_artikla_naziv: str | None = None
    supergrupa_artikla: str | None = None
    supergrupa_artikla_naziv: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ArtiklOut(BaseModel):
    artikl_uid: str
    artikl: str
    naziv: str | None = None
    naziv_kratki: str | None = None
    jm: str | None = None
    vpc: float | None = None
    mpc: float | None = None
    duzina: float | None = None
    sirina: float | None = None
    visina: float | None = None
    masa: float | None = None
    volumen: float | None = None
    grupa_artikla_uid: str | None = None
    grupa_artikla: str | None = None
    grupa_artikla_naziv: str | None = None
    glavni_dobavljac: str | None = None
    synced_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Kriterija SKU
# ==============================================================================


class KriterijaSkuBase(BaseModel):
    naziv: str
    opis: str | None = None


class KriterijaSkuCreate(KriterijaSkuBase):
    pass


class KriterijaSkuUpdate(BaseModel):
    naziv: str | None = None
    opis: str | None = None


class KriterijaSkuOut(KriterijaSkuBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Artikl Kriterija
# ==============================================================================


class ArtiklKriterijaCreate(BaseModel):
    artikl: str
    kriterija_id: int


class ArtiklKriterijaOut(BaseModel):
    id: int
    artikl: str
    artikl_naziv: str | None = None
    kriterija_id: int

    model_config = ConfigDict(from_attributes=True)


class ArtiklKriterijaImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str] = []

