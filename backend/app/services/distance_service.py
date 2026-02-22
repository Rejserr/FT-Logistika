"""
Distance / Directions servis s DB cache-om.

Podržava OpenRouteService (ORS), Google Maps, OSRM i TomTom kao providere.
Provider se odabire preko DB settings tablice (key: 'geocoding_provider').
"""
from __future__ import annotations

import hashlib
import logging
import time
from typing import NamedTuple

import requests
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.models.sync_models import DistanceMatrixCache

logger = logging.getLogger(__name__)


class DistanceResult(NamedTuple):
    """Rezultat distance upita."""
    distance_m: int | None  # udaljenost u metrima
    duration_s: int | None  # trajanje u sekundama
    from_cache: bool


def _get_provider(db: Session) -> str:
    """Dohvati aktivni provider iz DB settings."""
    from app.models.config_models import Setting
    from sqlalchemy import func as sqlfunc
    row = db.execute(
        select(Setting).where(sqlfunc.upper(Setting.key) == "GEOCODING_PROVIDER")
    ).scalar_one_or_none()
    if row and row.value:
        return row.value.strip().lower()
    if app_settings.ORS_API_KEY:
        return "ors"
    if app_settings.TOMTOM_API_KEY:
        return "tomtom"
    if app_settings.GOOGLE_MAPS_API_KEY:
        return "google"
    return "osrm"


class DistanceMatrixService:
    """Servis za izračun udaljenosti između točaka s više providera."""

    @staticmethod
    def _hash_location(lat: float, lng: float) -> str:
        key = f"{lat:.5f},{lng:.5f}"
        return hashlib.sha256(key.encode("utf-8")).hexdigest()

    def _get_from_cache(self, db: Session, origin_hash: str, dest_hash: str) -> DistanceMatrixCache | None:
        return db.execute(
            select(DistanceMatrixCache).where(
                and_(
                    DistanceMatrixCache.origin_hash == origin_hash,
                    DistanceMatrixCache.dest_hash == dest_hash,
                )
            )
        ).scalar_one_or_none()

    def _save_to_cache(
        self, db: Session, origin_hash: str, dest_hash: str,
        distance_m: int | None, duration_s: int | None, provider: str,
    ) -> DistanceMatrixCache:
        cache_entry = DistanceMatrixCache(
            origin_hash=origin_hash, dest_hash=dest_hash,
            distance_m=distance_m, duration_s=duration_s, provider=provider,
        )
        db.add(cache_entry)
        db.commit()
        db.refresh(cache_entry)
        return cache_entry

    # -------------------------------------------------------------------------
    # Provider implementations
    # -------------------------------------------------------------------------

    def _distance_osrm(
        self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float,
    ) -> DistanceResult:
        """Besplatni OSRM demo server za routing/distance."""
        try:
            url = (
                f"http://router.project-osrm.org/route/v1/driving/"
                f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
                f"?overview=false"
            )
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                return DistanceResult(
                    distance_m=int(route["distance"]),
                    duration_s=int(route["duration"]),
                    from_cache=False,
                )
            return DistanceResult(None, None, False)
        except Exception as e:
            logger.exception("OSRM distance error: %s", e)
            return DistanceResult(None, None, False)

    def _distance_ors(
        self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float,
    ) -> DistanceResult:
        """OpenRouteService directions API. Fallback na OSRM ako ORS zakaže."""
        api_key = app_settings.ORS_API_KEY
        if not api_key:
            logger.warning("ORS API ključ nedostaje, fallback na OSRM")
            return self._distance_osrm(origin_lat, origin_lng, dest_lat, dest_lng)
        try:
            resp = requests.post(
                "https://api.openrouteservice.org/v2/directions/driving-car",
                json={
                    "coordinates": [
                        [origin_lng, origin_lat],
                        [dest_lng, dest_lat],
                    ],
                },
                headers={
                    "Authorization": api_key,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            routes = data.get("routes", [])
            if routes:
                summary = routes[0].get("summary", {})
                return DistanceResult(
                    distance_m=int(summary.get("distance", 0)),
                    duration_s=int(summary.get("duration", 0)),
                    from_cache=False,
                )
            return DistanceResult(None, None, False)
        except Exception as e:
            logger.warning("ORS distance error: %s – fallback na OSRM", e)
            return self._distance_osrm(origin_lat, origin_lng, dest_lat, dest_lng)

    def _distance_google(
        self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float,
    ) -> DistanceResult:
        """Google Maps Distance Matrix API."""
        api_key = app_settings.GOOGLE_MAPS_API_KEY
        if not api_key:
            logger.warning("Google Maps API ključ nedostaje")
            return DistanceResult(None, None, False)
        try:
            import googlemaps
            gmaps = googlemaps.Client(key=api_key)
            result = gmaps.distance_matrix(
                origins=[(origin_lat, origin_lng)],
                destinations=[(dest_lat, dest_lng)],
                mode="driving", language="hr", units="metric",
            )
            element = result["rows"][0]["elements"][0]
            if element["status"] == "OK":
                return DistanceResult(
                    distance_m=element["distance"]["value"],
                    duration_s=element["duration"]["value"],
                    from_cache=False,
                )
            return DistanceResult(None, None, False)
        except Exception as e:
            logger.exception("Google distance error: %s", e)
            return DistanceResult(None, None, False)

    # -------------------------------------------------------------------------
    # TomTom helpers & implementations
    # -------------------------------------------------------------------------

    @staticmethod
    def _tomtom_truck_params() -> dict:
        """Zadani TomTom truck parametri za komercijalni prijevoz."""
        return {
            "travelMode": "truck",
            "vehicleCommercial": "true",
        }

    def _distance_tomtom(
        self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float,
    ) -> DistanceResult:
        """TomTom Calculate Route API s truck profilom. Fallback na OSRM."""
        api_key = app_settings.TOMTOM_API_KEY
        if not api_key:
            logger.warning("TomTom API ključ nedostaje, fallback na OSRM")
            return self._distance_osrm(origin_lat, origin_lng, dest_lat, dest_lng)
        try:
            locations = f"{origin_lat},{origin_lng}:{dest_lat},{dest_lng}"
            params = {
                "key": api_key,
                **self._tomtom_truck_params(),
            }
            resp = requests.get(
                f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json",
                params=params,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            routes = data.get("routes", [])
            if routes:
                summary = routes[0].get("summary", {})
                return DistanceResult(
                    distance_m=int(summary.get("lengthInMeters", 0)),
                    duration_s=int(summary.get("travelTimeInSeconds", 0)),
                    from_cache=False,
                )
            return DistanceResult(None, None, False)
        except Exception as e:
            logger.warning("TomTom distance error: %s – fallback na OSRM", e)
            return self._distance_osrm(origin_lat, origin_lng, dest_lat, dest_lng)

    def _route_geometry_tomtom(
        self, coordinates: list[tuple[float, float]],
    ) -> list[list[float]] | None:
        """TomTom Calculate Route API – dohvati geometry s truck profilom."""
        api_key = app_settings.TOMTOM_API_KEY
        if not api_key:
            logger.warning("TomTom API ključ nedostaje za geometry")
            return None
        try:
            locations = ":".join(f"{lat},{lng}" for lat, lng in coordinates)
            params = {
                "key": api_key,
                "routeRepresentation": "polyline",
                **self._tomtom_truck_params(),
            }
            logger.info("TomTom geometry request: %d waypoints", len(coordinates))
            resp = requests.get(
                f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json",
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            routes = data.get("routes", [])
            if routes:
                all_points: list[list[float]] = []
                for leg in routes[0].get("legs", []):
                    for point in leg.get("points", []):
                        all_points.append([point["latitude"], point["longitude"]])
                if all_points:
                    logger.info("TomTom geometry: dobiveno %d koordinata", len(all_points))
                    return all_points
            logger.warning("TomTom geometry: prazan routes odgovor")
            return None
        except Exception as e:
            logger.exception("TomTom route geometry error: %s", e)
            return None

    def _distance_matrix_tomtom_sync(
        self, locations: list[tuple[float, float]],
    ) -> tuple[list[list[int]], list[list[int]]] | None:
        """TomTom Matrix Routing v2 – sync za matrice <= 100 ćelija."""
        api_key = app_settings.TOMTOM_API_KEY
        if not api_key:
            return None
        n = len(locations)
        try:
            origins = [{"point": {"latitude": lat, "longitude": lng}} for lat, lng in locations]
            destinations = [{"point": {"latitude": lat, "longitude": lng}} for lat, lng in locations]
            body: dict = {
                "origins": origins,
                "destinations": destinations,
                "options": {
                    **self._tomtom_truck_params(),
                },
            }
            logger.info("TomTom Matrix sync: %d lokacija (%d ćelija)", n, n * n)
            resp = requests.post(
                "https://api.tomtom.com/routing/1/matrix/sync/json",
                params={"key": api_key},
                json=body,
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            return self._parse_tomtom_matrix(data, n)
        except Exception as e:
            logger.exception("TomTom Matrix sync error: %s", e)
            return None

    def _distance_matrix_tomtom_async(
        self, locations: list[tuple[float, float]],
    ) -> tuple[list[list[int]], list[list[int]]] | None:
        """TomTom Matrix Routing v2 – async za matrice > 100 ćelija."""
        api_key = app_settings.TOMTOM_API_KEY
        if not api_key:
            return None
        n = len(locations)
        try:
            origins = [{"point": {"latitude": lat, "longitude": lng}} for lat, lng in locations]
            destinations = [{"point": {"latitude": lat, "longitude": lng}} for lat, lng in locations]
            body: dict = {
                "origins": origins,
                "destinations": destinations,
                "options": {
                    **self._tomtom_truck_params(),
                },
            }
            logger.info("TomTom Matrix async: %d lokacija (%d ćelija)", n, n * n)
            submit_resp = requests.post(
                "https://api.tomtom.com/routing/1/matrix/async/json",
                params={"key": api_key},
                json=body,
                timeout=30,
            )
            if submit_resp.status_code not in (200, 202):
                logger.warning("TomTom Matrix async submit HTTP %d", submit_resp.status_code)
                return None

            redirect_url = submit_resp.headers.get("Location")
            if not redirect_url:
                data = submit_resp.json()
                return self._parse_tomtom_matrix(data, n)

            max_polls = 30
            poll_interval = 2.0
            for attempt in range(max_polls):
                time.sleep(poll_interval)
                poll_resp = requests.get(
                    redirect_url,
                    params={"key": api_key},
                    timeout=30,
                )
                if poll_resp.status_code == 200:
                    data = poll_resp.json()
                    result = self._parse_tomtom_matrix(data, n)
                    if result:
                        logger.info("TomTom Matrix async: rezultat dobiven nakon %d pokušaja", attempt + 1)
                        return result
                elif poll_resp.status_code == 202:
                    logger.debug("TomTom Matrix async: još se računa (pokušaj %d)", attempt + 1)
                    continue
                else:
                    logger.warning("TomTom Matrix async poll HTTP %d", poll_resp.status_code)
                    return None

            logger.warning("TomTom Matrix async: istekao timeout nakon %d pokušaja", max_polls)
            return None
        except Exception as e:
            logger.exception("TomTom Matrix async error: %s", e)
            return None

    @staticmethod
    def _parse_tomtom_matrix(
        data: dict, n: int,
    ) -> tuple[list[list[int]], list[list[int]]] | None:
        """Parsiraj TomTom Matrix v2 response u NxN matrice."""
        matrix_data = data.get("data", [])
        if not matrix_data:
            matrix_data = data.get("matrix", [])

        if not matrix_data:
            logger.warning("TomTom Matrix: nema 'data' ni 'matrix' u odgovoru. Keys: %s", list(data.keys()))
            return None

        dist_matrix = [[0] * n for _ in range(n)]
        dur_matrix = [[0] * n for _ in range(n)]

        for item in matrix_data:
            oi = item.get("originIndex", 0)
            di = item.get("destinationIndex", 0)
            summary = item.get("routeSummary", {})
            if item.get("statusCode", 200) == 200 and summary:
                dist_matrix[oi][di] = int(summary.get("lengthInMeters", 0))
                dur_matrix[oi][di] = int(summary.get("travelTimeInSeconds", 0))

        return (dist_matrix, dur_matrix)

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def get_distance(
        self, db: Session,
        origin_lat: float, origin_lng: float,
        dest_lat: float, dest_lng: float,
    ) -> DistanceResult:
        """Dohvati udaljenost i trajanje između dvije točke (s cache-om)."""
        origin_hash = self._hash_location(origin_lat, origin_lng)
        dest_hash = self._hash_location(dest_lat, dest_lng)

        # 1. Cache
        cached = self._get_from_cache(db, origin_hash, dest_hash)
        if cached:
            return DistanceResult(distance_m=cached.distance_m, duration_s=cached.duration_s, from_cache=True)

        # 2. Provider
        provider = _get_provider(db)

        if provider == "google":
            result = self._distance_google(origin_lat, origin_lng, dest_lat, dest_lng)
        elif provider == "ors":
            result = self._distance_ors(origin_lat, origin_lng, dest_lat, dest_lng)
        elif provider == "tomtom":
            result = self._distance_tomtom(origin_lat, origin_lng, dest_lat, dest_lng)
        else:
            result = self._distance_osrm(origin_lat, origin_lng, dest_lat, dest_lng)

        # 3. Cache
        if result.distance_m is not None:
            self._save_to_cache(db, origin_hash, dest_hash, result.distance_m, result.duration_s, provider)

        return result

    def get_distance_matrix(
        self, db: Session, locations: list[tuple[float, float]],
    ) -> list[list[DistanceResult]]:
        """Izračunaj NxN matricu udaljenosti."""
        n = len(locations)
        matrix: list[list[DistanceResult]] = []
        for i in range(n):
            row: list[DistanceResult] = []
            for j in range(n):
                if i == j:
                    row.append(DistanceResult(0, 0, True))
                else:
                    row.append(self.get_distance(
                        db, locations[i][0], locations[i][1], locations[j][0], locations[j][1],
                    ))
            matrix.append(row)
        return matrix

    def get_distance_matrix_fast(
        self, locations: list[tuple[float, float]], db: Session | None = None,
    ) -> tuple[list[list[int]], list[list[int]]] | None:
        """
        Brzi NxN distance matrix koristeći OSRM Table API ili TomTom Matrix API.
        locations: lista (lat, lng).
        db: opcijski, potreban za čitanje providera (TomTom).
        Vraća (distance_matrix_m, duration_matrix_s) ili None ako ne uspije.
        """
        n = len(locations)
        if n < 2:
            return None

        provider = _get_provider(db) if db else "osrm"

        if provider == "tomtom" and app_settings.TOMTOM_API_KEY:
            if n * n <= 100:
                result = self._distance_matrix_tomtom_sync(locations)
            else:
                result = self._distance_matrix_tomtom_async(locations)
            if result:
                return result
            logger.warning("TomTom Matrix nije uspio, fallback na OSRM Table API")

        return self._distance_matrix_osrm(locations)

    def _distance_matrix_osrm(
        self, locations: list[tuple[float, float]],
    ) -> tuple[list[list[int]], list[list[int]]] | None:
        """OSRM Table API (1 HTTP poziv) za NxN matricu."""
        n = len(locations)
        try:
            coords_str = ";".join(f"{lng},{lat}" for lat, lng in locations)
            url = (
                f"http://router.project-osrm.org/table/v1/driving/"
                f"{coords_str}?annotations=distance,duration"
            )
            logger.info("OSRM Table API: %d lokacija", n)
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok":
                distances = data.get("distances", [])
                durations = data.get("durations", [])
                if len(distances) == n and len(durations) == n:
                    dist_matrix = [[int(d) for d in row] for row in distances]
                    dur_matrix = [[int(d) for d in row] for row in durations]
                    logger.info("OSRM Table API: %dx%d matrica dohvaćena", n, n)
                    return (dist_matrix, dur_matrix)
            logger.warning("OSRM Table API: neuspješan odgovor: code=%s", data.get("code"))
            return None
        except Exception as e:
            logger.exception("OSRM Table API error: %s", e)
            return None

    def get_route_geometry(
        self, db: Session, coordinates: list[tuple[float, float]],
    ) -> list[list[float]] | None:
        """
        Dohvati geometry rute (polyline) duž cesta za listu koordinata.
        coordinates: lista (lat, lng) - depot + svi stopovi po redoslijedu.
        Vraća listu [lat, lng] za crtanje na karti, ili None ako ne uspije.
        Probaj odabrani provider, pa OSRM kao fallback.
        """
        if len(coordinates) < 2:
            return None

        provider = _get_provider(db)
        logger.info("Route geometry provider: %s, %d waypoints", provider, len(coordinates))

        # TomTom
        if provider == "tomtom" and app_settings.TOMTOM_API_KEY:
            result = self._route_geometry_tomtom(coordinates)
            if result:
                return result

        # ORS
        if provider == "ors" and app_settings.ORS_API_KEY:
            result = self._route_geometry_ors(coordinates)
            if result:
                return result

        # OSRM kao primarni ili fallback
        return self._route_geometry_osrm(coordinates)

    def _route_geometry_ors(
        self, coordinates: list[tuple[float, float]],
    ) -> list[list[float]] | None:
        """ORS Directions API – koristi /geojson endpoint koji vraća LineString koordinate."""
        api_key = app_settings.ORS_API_KEY
        if not api_key:
            logger.warning("ORS API ključ nedostaje za geometry")
            return None
        try:
            # ORS koristi [lng, lat] u coordinates
            ors_coords = [[lng, lat] for lat, lng in coordinates]
            logger.info("ORS geometry request: %d waypoints", len(ors_coords))

            # VAŽNO: Koristimo /geojson endpoint koji vraća GeoJSON FeatureCollection
            # JSON endpoint (/driving-car) vraća encoded polyline string, ne GeoJSON!
            resp = requests.post(
                "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
                json={
                    "coordinates": ors_coords,
                },
                headers={
                    "Authorization": api_key,
                    "Content-Type": "application/json",
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            # GeoJSON response: FeatureCollection -> features[0] -> geometry -> coordinates
            features = data.get("features", [])
            if features:
                geom = features[0].get("geometry", {})
                if geom.get("type") == "LineString":
                    coords = geom.get("coordinates", [])
                    logger.info("ORS geometry: dobiveno %d koordinata za polyline", len(coords))
                    # GeoJSON coordinates su [lng, lat] - pretvori u [lat, lng] za Leaflet
                    return [[c[1], c[0]] for c in coords]
                else:
                    logger.warning("ORS geometry: neočekivani tip geometrije: %s", geom.get("type"))
            else:
                logger.warning("ORS geometry: prazan features array. Response keys: %s", list(data.keys()))

            return None
        except requests.exceptions.HTTPError as e:
            logger.error("ORS geometry HTTP error %s: %s", e.response.status_code if e.response else "?", e.response.text[:500] if e.response else "")
            return None
        except Exception as e:
            logger.exception("ORS route geometry error: %s", e)
            return None

    def _route_geometry_osrm(
        self, coordinates: list[tuple[float, float]],
    ) -> list[list[float]] | None:
        """OSRM Directions API s overview=full za geometry."""
        try:
            # OSRM format: lng,lat;lng,lat;...
            coords_str = ";".join(f"{lng},{lat}" for lat, lng in coordinates)
            url = (
                f"http://router.project-osrm.org/route/v1/driving/"
                f"{coords_str}?overview=full&geometries=geojson"
            )
            logger.info("OSRM geometry request: %d waypoints", len(coordinates))
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok" and data.get("routes"):
                geom = data["routes"][0].get("geometry")
                if geom and isinstance(geom, dict) and geom.get("type") == "LineString":
                    coords = geom.get("coordinates", [])
                    logger.info("OSRM geometry: dobiveno %d koordinata za polyline", len(coords))
                    return [[c[1], c[0]] for c in coords]
                else:
                    logger.warning("OSRM geometry: neočekivani format: type=%s", type(geom).__name__)
            else:
                logger.warning("OSRM geometry: code=%s", data.get("code"))
            return None
        except Exception as e:
            logger.exception("OSRM route geometry error: %s", e)
            return None


# Singleton
distance_service = DistanceMatrixService()
