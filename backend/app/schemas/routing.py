"""Pydantic sheme za routing module."""
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


class RouteStopOut(BaseModel):
    """Output shema za stop na ruti."""
    id: int
    nalog_uid: str
    redoslijed: int
    eta: datetime | None = None
    status: str | None = None
    partner_naziv: str | None = None
    partner_adresa: str | None = None
    partner_mjesto: str | None = None
    lat: float | None = None
    lng: float | None = None

    model_config = ConfigDict(from_attributes=True)


class RouteOut(BaseModel):
    """Output shema za rutu."""
    id: int
    datum: date | None = None
    raspored: date | None = None  # planirani datum dostave
    status: str | None = None
    algoritam: str | None = None
    vozilo_id: int | None = None
    vozilo_oznaka: str | None = None
    vozac_id: int | None = None
    driver_user_id: int | None = None
    driver_name: str | None = None
    warehouse_id: int | None = None
    izvor_tip: str | None = None
    izvor_id: int | None = None
    distance_km: float | None = None
    duration_min: int | None = None
    regije: str | None = None
    stops: list[RouteStopOut] = Field(default_factory=list)
    polyline: list[list[float]] | None = None

    model_config = ConfigDict(from_attributes=True)


class RouteListOut(BaseModel):
    """Output shema za listu ruta (bez stopova)."""
    id: int
    datum: date | None = None
    raspored: date | None = None
    status: str | None = None
    algoritam: str | None = None
    vozilo_id: int | None = None
    vozilo_oznaka: str | None = None
    vozac_id: int | None = None
    driver_name: str | None = None
    warehouse_id: int | None = None
    distance_km: float | None = None
    duration_min: int | None = None
    stops_count: int = 0
    wms_paleta: int | None = None
    regije: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CreateRouteRequest(BaseModel):
    """Request za kreiranje nove rute."""
    nalog_uids: list[str] = Field(..., min_length=1, description="Lista UID-ova naloga")
    vozilo_id: int | None = None
    vozac_id: int | None = None
    driver_user_id: int | None = None
    izvor_tip: str | None = Field(None, pattern="^(depot|store)$")
    izvor_id: int | None = None
    datum: date | None = None
    raspored: date | None = None
    start_time: time | None = None
    algoritam: str = Field(default="nearest_neighbor", pattern="^(nearest_neighbor|ortools|manual)$")


class ReorderStopsRequest(BaseModel):
    """Request za promjenu redoslijeda stopova."""
    new_order: list[str] = Field(..., min_length=1, description="Lista nalog_uid u novom redoslijedu")


class UpdateRouteStatusRequest(BaseModel):
    """Request za promjenu statusa rute."""
    status: str = Field(..., pattern="^(DRAFT|PLANNED|IN_PROGRESS|COMPLETED|CANCELLED)$")


class UpdateStopStatusRequest(BaseModel):
    """Request za promjenu statusa stopa."""
    status: str = Field(..., pattern="^(PENDING|ARRIVED|DELIVERED|FAILED|SKIPPED)$")


class OptimizeRouteRequest(BaseModel):
    """Request za optimizaciju postojeće rute."""
    algoritam: str = Field(default="nearest_neighbor", pattern="^(nearest_neighbor|ortools)$")


class GeocodingRequest(BaseModel):
    """Request za geocoding."""
    address: str = Field(..., min_length=3)


class GeocodingResponse(BaseModel):
    """Response za geocoding."""
    lat: float | None = None
    lng: float | None = None
    formatted_address: str | None = None
    from_cache: bool = False


class DistanceRequest(BaseModel):
    """Request za distance matrix."""
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float


class DistanceResponse(BaseModel):
    """Response za distance matrix."""
    distance_m: int | None = None
    duration_s: int | None = None
    distance_km: float | None = None
    duration_min: int | None = None
    from_cache: bool = False


class GeocodeOrdersRequest(BaseModel):
    """Request za geocodiranje odabranih naloga (preview na karti)."""
    nalog_uids: list[str] = Field(..., min_length=1)


class GeocodeOrderResult(BaseModel):
    """Geocodiran nalog za prikaz na karti."""
    nalog_uid: str
    lat: float | None = None
    lng: float | None = None
    address: str | None = None
    kupac: str | None = None
    demand_kg: float = 0
    demand_m3: float = 0
    nalog_prodaje: str | None = None


class ProviderInfoResponse(BaseModel):
    """Info o aktivnom geocoding/distance provideru."""
    provider: str
    has_google_key: bool = False
    has_ors_key: bool = False
    has_tomtom_key: bool = False
    tomtom_map_key: str = ""
