from datetime import date

from pydantic import BaseModel


class SyncOrdersRequest(BaseModel):
    statusi: list[str] = []
    datum_od: date | None = None
    datum_do: date | None = None


class RefreshOrdersRequest(BaseModel):
    datum_od: date | None = None


class SyncByRasporedRequest(BaseModel):
    raspored_datum: date


class SyncResponse(BaseModel):
    sync_id: int
    status: str
    message: str | None = None
