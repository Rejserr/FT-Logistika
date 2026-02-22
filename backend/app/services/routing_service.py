"""
Routing servis za kreiranje i optimizaciju ruta.

Podržava Nearest Neighbor, OR-Tools VRP i Manual algoritme.
Koristi konfigurabilan geocoding/distance provider (ORS/Google/Nominatim/OSRM).
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

import requests

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.models.config_models import Setting
from app.models.erp_models import NalogHeader, NalogDetail, Partner, Skladiste, Artikl
from app.models.routing_models import Ruta, RutaPolyline, RutaStop
from app.models.routing_order_models import (
    NalogDetailRutiranje,
    NalogHeaderArhiva,
    NalogHeaderRutiranje,
)
from app.models.vehicle_models import Vozilo
from app.services.distance_service import distance_service, _get_provider as _get_distance_provider
from app.services.geocoding_service import geocoding_service
from app.services.ortools_optimizer import (
    Location,
    Vehicle,
    ortools_optimizer,
)

logger = logging.getLogger(__name__)


def _get_setting(db: Session, key: str, default: str = "") -> str:
    """Dohvati vrijednost iz settings tablice (case-insensitive)."""
    from sqlalchemy import func as sqlfunc
    row = db.execute(
        select(Setting).where(sqlfunc.upper(Setting.key) == key.upper())
    ).scalar_one_or_none()
    return (row.value or default) if row else default


class RouteStop:
    """Reprezentacija stopa na ruti."""

    def __init__(
        self,
        nalog_uid: str,
        lat: float,
        lng: float,
        address: str,
        partner_sifra: str | None = None,
        demand_kg: float = 0,
        demand_m3: float = 0,
    ) -> None:
        self.nalog_uid = nalog_uid
        self.lat = lat
        self.lng = lng
        self.address = address
        self.partner_sifra = partner_sifra
        self.demand_kg = demand_kg
        self.demand_m3 = demand_m3
        self.eta: datetime | None = None
        self.distance_from_prev_m: int = 0
        self.duration_from_prev_s: int = 0


class RoutingService:
    """Servis za kreiranje i optimizaciju ruta."""

    def _get_config(self, db: Session) -> dict[str, Any]:
        """Dohvati sve routing-related postavke."""
        service_time_str = _get_setting(db, "DEFAULT_SERVICE_TIME_MINUTES", str(app_settings.DEFAULT_SERVICE_TIME_MINUTES))
        max_stops_str = _get_setting(db, "MAX_STOPS_PER_ROUTE", str(app_settings.MAX_STOPS_PER_ROUTE))
        depot_lat_str = _get_setting(db, "DEPOT_LAT", "45.815")
        depot_lng_str = _get_setting(db, "DEPOT_LNG", "15.9819")

        try:
            service_time = int(service_time_str) * 60  # u sekunde
        except (ValueError, TypeError):
            service_time = app_settings.DEFAULT_SERVICE_TIME_MINUTES * 60

        try:
            max_stops = int(max_stops_str)
        except (ValueError, TypeError):
            max_stops = app_settings.MAX_STOPS_PER_ROUTE

        try:
            depot_lat = float(depot_lat_str)
            depot_lng = float(depot_lng_str)
        except (ValueError, TypeError):
            depot_lat = 45.815
            depot_lng = 15.9819

        return {
            "service_time_s": service_time,
            "max_stops": max_stops,
            "depot_lat": depot_lat,
            "depot_lng": depot_lng,
        }

    def _get_depot_location(self, db: Session) -> tuple[float, float]:
        """Dohvati depot koordinate iz DB settings."""
        config = self._get_config(db)
        return (config["depot_lat"], config["depot_lng"])

    def _geocode_order(
        self, db: Session, nalog
    ) -> tuple[float, float] | None:
        """Geocodiraj adresu naloga koristeći podatke partnera. Radi i s NalogHeader i NalogHeaderRutiranje."""
        if not nalog.partner_uid:
            return None

        partner = db.get(Partner, nalog.partner_uid)
        if not partner:
            return None

        address_parts = []
        if partner.adresa:
            address_parts.append(partner.adresa)
        if partner.naziv_mjesta:
            address_parts.append(partner.naziv_mjesta)
        if partner.postanski_broj:
            address_parts.append(partner.postanski_broj)
        # Mapiranje kratice države u puni naziv za bolje geocoding rezultate
        drzava = partner.drzava or ""
        drzava_map = {"HR": "Hrvatska", "SI": "Slovenija", "BA": "Bosna i Hercegovina", "RS": "Srbija", "HU": "Mađarska", "AT": "Austrija"}
        drzava_full = drzava_map.get(drzava.strip().upper(), drzava) if drzava else "Hrvatska"
        address_parts.append(drzava_full)

        if not address_parts:
            return None

        address = ", ".join(address_parts)
        result = geocoding_service.geocode(db, address)

        if result.lat and result.lng:
            return (float(result.lat), float(result.lng))
        return None

    def _calculate_demand(self, db: Session, nalog_uid: str, from_rutiranje: bool = False) -> tuple[float, float]:
        """Izračunaj ukupnu masu (kg) i volumen (m³) za nalog. Provjerava i rutiranje tablicu."""
        DetailModel = NalogDetailRutiranje if from_rutiranje else NalogDetail
        details = db.execute(
            select(DetailModel).where(DetailModel.nalog_prodaje_uid == nalog_uid)
        ).scalars().all()
        # Ako nema rezultata i nismo gledali rutiranje, probaj rutiranje
        if not details and not from_rutiranje:
            details = db.execute(
                select(NalogDetailRutiranje).where(NalogDetailRutiranje.nalog_prodaje_uid == nalog_uid)
            ).scalars().all()

        total_kg = 0.0
        total_m3 = 0.0

        for d in details:
            qty = float(d.kolicina or 0)
            if qty <= 0:
                continue
            # Pronađi artikl za masu/volumen
            if d.artikl:
                artikl = db.execute(
                    select(Artikl).where(Artikl.artikl == d.artikl)
                ).scalar_one_or_none()
                if artikl:
                    masa = float(artikl.masa or 0)
                    volumen = float(artikl.volumen or 0)
                    total_kg += masa * qty
                    total_m3 += (volumen / 1_000_000) * qty  # mm³ -> m³

        return (total_kg, total_m3)

    def geocode_orders(
        self, db: Session, nalog_uids: list[str]
    ) -> list[dict[str, Any]]:
        """
        Geocodiraj listu naloga - za preview na karti.
        Traži PRVO u rutiranju pa u originalima.
        Vraća listu {nalog_uid, lat, lng, address, kupac, demand_kg, demand_m3}.
        """
        results = []
        depot = self._get_depot_location(db)

        for uid in nalog_uids:
            # Traži u rutiranju prvo, pa u originalu
            nalog = db.get(NalogHeaderRutiranje, uid)
            from_rutiranje = nalog is not None
            if not nalog:
                nalog = db.get(NalogHeader, uid)
            if not nalog:
                continue

            location = self._geocode_order(db, nalog)
            partner = db.get(Partner, nalog.partner_uid) if nalog.partner_uid else None

            kupac = ""
            address = ""
            if partner:
                if partner.naziv:
                    kupac = partner.naziv
                    if partner.ime and partner.prezime:
                        kupac += f" => {partner.ime} {partner.prezime}"
                elif partner.ime and partner.prezime:
                    kupac = f"{partner.ime} {partner.prezime}"
                address = f"{partner.adresa or ''}, {partner.naziv_mjesta or ''}"

            demand_kg, demand_m3 = self._calculate_demand(db, uid, from_rutiranje=from_rutiranje)

            results.append({
                "nalog_uid": uid,
                "lat": location[0] if location else None,
                "lng": location[1] if location else None,
                "address": address,
                "kupac": kupac,
                "demand_kg": round(demand_kg, 2),
                "demand_m3": round(demand_m3, 4),
                "nalog_prodaje": str(nalog.broj) if nalog.broj else uid[:15],
            })

        return results

    def _nearest_neighbor(
        self,
        db: Session,
        depot: tuple[float, float],
        stops: list[RouteStop],
    ) -> list[RouteStop]:
        """
        Nearest Neighbor algoritam za TSP.
        Koristi OSRM Table API za brzi NxN matrix (1 poziv umjesto N^2).
        """
        if not stops:
            return []

        # Pripremi lokacije: [depot, stop1, stop2, ...]
        locations = [depot] + [(s.lat, s.lng) for s in stops]
        n = len(locations)

        # Pokušaj dohvatiti cijelu matricu odjednom (OSRM/TomTom Table API - 1 poziv)
        matrix_result = distance_service.get_distance_matrix_fast(locations, db=db)

        if matrix_result:
            dist_matrix, dur_matrix = matrix_result
            logger.info("Nearest Neighbor: koristim brzi OSRM Table API (%dx%d matrica)", n, n)

            # Index mapiranje: locations[0] = depot, locations[1..n-1] = stops[0..n-2]
            current_idx = 0  # počinjemo s depot
            unvisited_indices = list(range(1, n))  # indeksi stopova u matrici
            ordered: list[RouteStop] = []

            while unvisited_indices:
                best_idx: int | None = None
                best_distance = float("inf")

                for idx in unvisited_indices:
                    d = dist_matrix[current_idx][idx]
                    if d < best_distance:
                        best_distance = d
                        best_idx = idx

                if best_idx is not None:
                    stop = stops[best_idx - 1]  # -1 jer depot je na poziciji 0
                    stop.distance_from_prev_m = dist_matrix[current_idx][best_idx]
                    stop.duration_from_prev_s = dur_matrix[current_idx][best_idx]
                    ordered.append(stop)
                    unvisited_indices.remove(best_idx)
                    current_idx = best_idx
                    logger.debug(
                        "NN step %d: -> stop %s (%.1f km, %d min)",
                        len(ordered), stop.nalog_uid,
                        stop.distance_from_prev_m / 1000, stop.duration_from_prev_s // 60,
                    )
                else:
                    # Ne bi se trebalo dogoditi ako matrica ima podatke
                    for idx in unvisited_indices:
                        ordered.append(stops[idx - 1])
                    break

            logger.info(
                "Nearest Neighbor: optimizirano %d stopova, ukupna udaljenost: %.1f km",
                len(ordered), sum(s.distance_from_prev_m for s in ordered) / 1000,
            )
            return ordered

        # Fallback: pojedinačni pozivi (sporije, ali radi)
        logger.warning("Nearest Neighbor: OSRM Table API nedostupan, koristim pojedinačne pozive")
        current_location = depot
        unvisited = stops.copy()
        ordered = []

        while unvisited:
            best_stop: RouteStop | None = None
            best_distance = float("inf")

            for stop in unvisited:
                result = distance_service.get_distance(
                    db, current_location[0], current_location[1], stop.lat, stop.lng,
                )
                if result.distance_m is not None and result.distance_m < best_distance:
                    best_distance = result.distance_m
                    best_stop = stop

            if best_stop:
                dist_result = distance_service.get_distance(
                    db, current_location[0], current_location[1], best_stop.lat, best_stop.lng,
                )
                best_stop.distance_from_prev_m = dist_result.distance_m or 0
                best_stop.duration_from_prev_s = dist_result.duration_s or 0
                ordered.append(best_stop)
                unvisited.remove(best_stop)
                current_location = (best_stop.lat, best_stop.lng)
            else:
                logger.warning("Nearest Neighbor: ne mogu izračunati udaljenost, dodajem ostale stopove nesortirane")
                ordered.extend(unvisited)
                break

        return ordered

    def _optimize_with_ortools(
        self,
        db: Session,
        depot: tuple[float, float],
        stops: list[RouteStop],
        vozilo_id: int | None,
    ) -> list[RouteStop]:
        """Optimizacija s OR-Tools VRP solverom."""
        if not stops:
            return []

        locations: list[Location] = [
            Location(id="depot", lat=depot[0], lng=depot[1])
        ]

        config = self._get_config(db)
        service_time_min = config["service_time_s"] // 60

        for stop in stops:
            locations.append(
                Location(
                    id=stop.nalog_uid,
                    lat=stop.lat,
                    lng=stop.lng,
                    demand_kg=stop.demand_kg,
                    demand_m3=stop.demand_m3,
                    service_time=service_time_min,
                )
            )

        vehicle_capacity_kg = 1000.0
        vehicle_capacity_m3 = 10.0

        if vozilo_id:
            vozilo = db.get(Vozilo, vozilo_id)
            if vozilo:
                vehicle_capacity_kg = float(vozilo.nosivost_kg or 1000)
                vehicle_capacity_m3 = float(vozilo.volumen_m3 or 10)

        vehicles = [
            Vehicle(
                id=vozilo_id or 1,
                capacity_kg=vehicle_capacity_kg,
                capacity_m3=vehicle_capacity_m3,
            )
        ]

        n = len(locations)
        distance_matrix: list[list[int]] = []
        duration_matrix: list[list[int]] = []

        # Pokušaj brzi OSRM/TomTom Table API (1 poziv za cijelu matricu)
        locs_for_matrix = [(loc.lat, loc.lng) for loc in locations]
        fast_result = distance_service.get_distance_matrix_fast(locs_for_matrix, db=db)
        if fast_result:
            distance_matrix, duration_matrix = fast_result
            logger.info("OR-Tools: koristim brzi OSRM Table API (%dx%d)", n, n)
        else:
            # Fallback: pojedinačni pozivi
            logger.warning("OR-Tools: OSRM Table API nedostupan, koristim pojedinačne pozive")
            for i in range(n):
                dist_row: list[int] = []
                dur_row: list[int] = []
                for j in range(n):
                    if i == j:
                        dist_row.append(0)
                        dur_row.append(0)
                    else:
                        result = distance_service.get_distance(
                            db, locations[i].lat, locations[i].lng, locations[j].lat, locations[j].lng,
                        )
                        dist_row.append(result.distance_m or 10000)
                        dur_row.append(result.duration_s or 600)
                distance_matrix.append(dist_row)
                duration_matrix.append(dur_row)

        result = ortools_optimizer.optimize(
            locations=locations, vehicles=vehicles,
            distance_matrix=distance_matrix, duration_matrix=duration_matrix,
        )

        if not result.success or not result.routes:
            logger.warning("OR-Tools optimizacija nije uspjela: %s", result.message)
            return self._nearest_neighbor(db, depot, stops)

        stop_map = {s.nalog_uid: s for s in stops}
        ordered: list[RouteStop] = []

        for route in result.routes:
            for nalog_uid in route:
                if nalog_uid in stop_map:
                    ordered.append(stop_map[nalog_uid])

        prev_location = depot
        for stop in ordered:
            r = distance_service.get_distance(db, prev_location[0], prev_location[1], stop.lat, stop.lng)
            stop.distance_from_prev_m = r.distance_m or 0
            stop.duration_from_prev_s = r.duration_s or 0
            prev_location = (stop.lat, stop.lng)

        return ordered

    def _optimize_with_tomtom(
        self,
        db: Session,
        depot: tuple[float, float],
        stops: list[RouteStop],
    ) -> list[RouteStop]:
        """
        TomTom Waypoint Optimization API.
        Limit: do 12 waypoints (bez depota). Preko toga fallback na nearest_neighbor.
        """
        if len(stops) > 12:
            logger.info("TomTom Waypoint Opt: %d stopova > 12, fallback na nearest_neighbor", len(stops))
            return self._nearest_neighbor(db, depot, stops)

        api_key = app_settings.TOMTOM_API_KEY
        if not api_key:
            logger.warning("TomTom API ključ nedostaje, fallback na nearest_neighbor")
            return self._nearest_neighbor(db, depot, stops)

        try:
            waypoints = [
                {"point": {"latitude": s.lat, "longitude": s.lng}}
                for s in stops
            ]
            body: dict = {
                "waypoints": waypoints,
                "options": {
                    "travelMode": "truck",
                    "vehicleCommercial": True,
                },
            }
            # Depot kao origin
            body["origin"] = {"point": {"latitude": depot[0], "longitude": depot[1]}}

            logger.info("TomTom Waypoint Optimization: %d stopova", len(stops))
            resp = requests.post(
                "https://api.tomtom.com/routing/waypointoptimization/1",
                params={"key": api_key},
                json=body,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            optimized_order = data.get("optimizedOrder", [])
            if not optimized_order:
                logger.warning("TomTom Waypoint Opt: prazan optimizedOrder, fallback")
                return self._nearest_neighbor(db, depot, stops)

            ordered: list[RouteStop] = []
            for idx in optimized_order:
                if 0 <= idx < len(stops):
                    ordered.append(stops[idx])

            if len(ordered) != len(stops):
                logger.warning("TomTom Waypoint Opt: neočekivani broj stopova (%d vs %d)", len(ordered), len(stops))
                return self._nearest_neighbor(db, depot, stops)

            prev_location = depot
            for stop in ordered:
                r = distance_service.get_distance(db, prev_location[0], prev_location[1], stop.lat, stop.lng)
                stop.distance_from_prev_m = r.distance_m or 0
                stop.duration_from_prev_s = r.duration_s or 0
                prev_location = (stop.lat, stop.lng)

            logger.info("TomTom Waypoint Optimization: uspješno optimizirano %d stopova", len(ordered))
            return ordered

        except Exception as e:
            logger.exception("TomTom Waypoint Optimization error: %s – fallback na nearest_neighbor", e)
            return self._nearest_neighbor(db, depot, stops)

    def _calculate_etas(
        self, stops: list[RouteStop], start_time: datetime, service_time_s: int,
    ) -> None:
        """Izračunaj ETA za svaki stop."""
        current_time = start_time
        for stop in stops:
            current_time += timedelta(seconds=stop.duration_from_prev_s)
            stop.eta = current_time
            current_time += timedelta(seconds=service_time_s)

    def create_route(
        self,
        db: Session,
        nalog_uids: list[str],
        vozilo_id: int | None = None,
        vozac_id: int | None = None,
        izvor_tip: str | None = None,
        izvor_id: int | None = None,
        datum: date | None = None,
        raspored: date | None = None,
        start_time: datetime | None = None,
        algoritam: str = "nearest_neighbor",
        warehouse_id: int | None = None,
    ) -> Ruta:
        """
        Kreiraj novu rutu s optimiziranim redoslijedom stopova.
        
        Naloge traži PRVO u rutiranje tablicama, pa u originalima.
        Nakon kreiranja rute:
         - status rute -> PLANNED
         - nalozi u rutiranju: ruta_id = ruta.id, status_rutiranja = NA_RUTI
         - nalozi u originalima: DELETE (jer su vec kopirani u rutiranje)
        """
        config = self._get_config(db)
        route_date = datum or date.today()
        route_start = start_time or datetime.combine(route_date, datetime.min.time().replace(hour=8))

        ruta = Ruta(
            datum=route_date, raspored=raspored, status="PLANNED", algoritam=algoritam,
            vozilo_id=vozilo_id, vozac_id=vozac_id,
            warehouse_id=warehouse_id,
            izvor_tip=izvor_tip, izvor_id=izvor_id,
        )
        db.add(ruta)
        db.flush()

        # Depot iz settings
        depot = (config["depot_lat"], config["depot_lng"])

        stops: list[RouteStop] = []
        resolved_uids: list[str] = []  # UID-ovi naloga koji su uspjesno geocodirani

        for uid in nalog_uids:
            # Traži PRVO u rutiranju, pa u originalu
            nalog = db.get(NalogHeaderRutiranje, uid)
            from_rutiranje = nalog is not None
            if not nalog:
                nalog = db.get(NalogHeader, uid)
            if not nalog:
                logger.warning("Nalog %s nije pronađen ni u rutiranju ni u originalu", uid)
                continue

            location = self._geocode_order(db, nalog)
            if not location:
                logger.warning("Nije moguće geocodirati nalog %s", uid)
                continue

            partner = db.get(Partner, nalog.partner_uid) if nalog.partner_uid else None
            address = ""
            if partner:
                address = f"{partner.adresa or ''}, {partner.naziv_mjesta or ''}"

            demand_kg, demand_m3 = self._calculate_demand(db, uid, from_rutiranje=from_rutiranje)

            stops.append(
                RouteStop(
                    nalog_uid=uid, lat=location[0], lng=location[1],
                    address=address, partner_sifra=nalog.partner_uid,
                    demand_kg=demand_kg, demand_m3=demand_m3,
                )
            )
            resolved_uids.append(uid)

        # Optimiziraj redoslijed
        current_provider = _get_distance_provider(db)
        use_tomtom_opt = (
            current_provider == "tomtom"
            and app_settings.TOMTOM_API_KEY
            and len(stops) <= 12
            and algoritam != "manual"
        )

        if use_tomtom_opt and stops:
            stops = self._optimize_with_tomtom(db, depot, stops)
        elif algoritam == "ortools" and stops:
            stops = self._optimize_with_ortools(db, depot, stops, vozilo_id)
        elif algoritam == "nearest_neighbor" and stops:
            stops = self._nearest_neighbor(db, depot, stops)
        # manual = ostavi redoslijed kakav je

        # ETA
        self._calculate_etas(stops, route_start, config["service_time_s"])

        # Ukupno
        total_distance_m = sum(s.distance_from_prev_m for s in stops)
        total_duration_s = sum(s.duration_from_prev_s + config["service_time_s"] for s in stops)

        ruta.distance_km = Decimal(str(total_distance_m / 1000))
        ruta.duration_min = total_duration_s // 60

        for i, stop in enumerate(stops):
            ruta_stop = RutaStop(
                ruta_id=ruta.id, nalog_uid=stop.nalog_uid,
                redoslijed=i + 1, eta=stop.eta, status="PENDING",
            )
            db.add(ruta_stop)

        # ===== Polyline duž cesta (ORS/OSRM) =====
        coords_for_geom = [depot] + [(s.lat, s.lng) for s in stops]
        geometry = distance_service.get_route_geometry(db, coords_for_geom)
        if geometry:
            polyline_json = json.dumps(geometry)
            db.add(RutaPolyline(
                ruta_id=ruta.id,
                polyline=polyline_json,
                distance_km=ruta.distance_km,
                duration_min=ruta.duration_min,
            ))

        # ===== POST-ROUTE CREATION: ažuriraj rutiranje tablice i obriši originale =====
        for uid in resolved_uids:
            # Ažuriraj u rutiranju: postavi ruta_id i status_rutiranja
            rut_header = db.get(NalogHeaderRutiranje, uid)
            if rut_header:
                rut_header.ruta_id = ruta.id
                rut_header.status_rutiranja = "NA_RUTI"

            # Obriši iz originala (jer su vec sigurno u rutiranju)
            orig_header = db.get(NalogHeader, uid)
            if orig_header:
                # Najprije stavke
                orig_details = db.execute(
                    select(NalogDetail).where(NalogDetail.nalog_prodaje_uid == uid)
                ).scalars().all()
                for od in orig_details:
                    db.delete(od)
                db.delete(orig_header)

        db.commit()
        db.refresh(ruta)

        logger.info(
            "Kreirana ruta %d s %d stopova, %.2f km, %d min (status: PLANNED)",
            ruta.id, len(stops), float(ruta.distance_km or 0), ruta.duration_min or 0,
        )
        return ruta

    def reorder_stops(self, db: Session, ruta_id: int, new_order: list[str]) -> Ruta:
        """Ručna promjena redoslijeda stopova."""
        ruta = db.get(Ruta, ruta_id)
        if not ruta:
            raise ValueError(f"Ruta {ruta_id} nije pronađena")

        existing_stops = db.execute(
            select(RutaStop).where(RutaStop.ruta_id == ruta_id)
        ).scalars().all()

        stop_map = {s.nalog_uid: s for s in existing_stops}
        ordered_stops: list[RutaStop] = []
        for uid in new_order:
            if uid in stop_map:
                stop_map[uid].redoslijed = len(ordered_stops) + 1
                ordered_stops.append(stop_map[uid])

        if ordered_stops:
            depot = self._get_depot_location(db)
            coords_for_geom = [depot]
            for stop in ordered_stops:
                nalog = db.get(NalogHeaderRutiranje, stop.nalog_uid) or db.get(NalogHeader, stop.nalog_uid)
                if nalog:
                    coords = self._geocode_order(db, nalog)
                    if coords:
                        coords_for_geom.append(coords)
            if len(coords_for_geom) >= 2:
                geometry = distance_service.get_route_geometry(db, coords_for_geom)
                if geometry:
                    polyline_obj = db.execute(
                        select(RutaPolyline).where(RutaPolyline.ruta_id == ruta_id)
                    ).scalar_one_or_none()
                    if polyline_obj:
                        polyline_obj.polyline = json.dumps(geometry)
                    else:
                        db.add(RutaPolyline(
                            ruta_id=ruta_id,
                            polyline=json.dumps(geometry),
                            distance_km=ruta.distance_km,
                            duration_min=ruta.duration_min,
                        ))

        db.commit()
        db.refresh(ruta)
        return ruta

    def get_route_with_stops(self, db: Session, ruta_id: int) -> dict[str, Any]:
        """Dohvati rutu s detaljima stopova. Traži naloge u rutiranju, originalu i arhivi."""
        ruta = db.get(Ruta, ruta_id)
        if not ruta:
            return {}

        stops = db.execute(
            select(RutaStop).where(RutaStop.ruta_id == ruta_id).order_by(RutaStop.redoslijed)
        ).scalars().all()

        stop_details = []
        for stop in stops:
            # Traži nalog u rutiranju, pa u originalu
            nalog = db.get(NalogHeaderRutiranje, stop.nalog_uid)
            if not nalog:
                nalog = db.get(NalogHeader, stop.nalog_uid)

            # Fallback na arhivu (za završene/arhivirane rute)
            arhiv_header = None
            if not nalog:
                arhiv_header = db.execute(
                    select(NalogHeaderArhiva).where(
                        NalogHeaderArhiva.nalog_prodaje_uid == stop.nalog_uid,
                        NalogHeaderArhiva.ruta_id == ruta_id,
                    )
                ).scalar_one_or_none()

            partner = None
            lat = None
            lng = None

            if nalog and nalog.partner_uid:
                partner = db.get(Partner, nalog.partner_uid)
                if partner:
                    coords = self._geocode_order(db, nalog)
                    if coords:
                        lat, lng = coords
            elif arhiv_header and arhiv_header.partner_uid:
                partner = db.get(Partner, arhiv_header.partner_uid)
                if partner:
                    # Za arhivirane, koristi geocoding cache
                    address_parts = [partner.adresa or ""]
                    if partner.naziv_mjesta:
                        address_parts.append(partner.naziv_mjesta)
                    if partner.postanski_broj:
                        address_parts.append(partner.postanski_broj)
                    address_parts.append("Hrvatska")
                    full_address = ", ".join(p for p in address_parts if p)
                    result = geocoding_service.geocode(db, full_address)
                    if result.lat is not None:
                        lat, lng = float(result.lat), float(result.lng)

            partner_naziv = None
            if partner:
                if partner.ime and partner.prezime:
                    partner_naziv = f"{partner.ime} {partner.prezime}"
                elif partner.naziv:
                    partner_naziv = partner.naziv
                else:
                    partner_naziv = partner.partner

            stop_details.append({
                "id": stop.id,
                "nalog_uid": stop.nalog_uid,
                "redoslijed": stop.redoslijed,
                "eta": stop.eta.isoformat() if stop.eta else None,
                "status": stop.status,
                "partner_naziv": partner_naziv,
                "partner_adresa": partner.adresa if partner else None,
                "partner_mjesto": partner.naziv_mjesta if partner else None,
                "lat": lat,
                "lng": lng,
            })

        vozilo = db.get(Vozilo, ruta.vozilo_id) if ruta.vozilo_id else None

        driver_name = ruta.driver_name

        # Polyline za prikaz rute duž cesta
        polyline_obj = db.execute(
            select(RutaPolyline).where(RutaPolyline.ruta_id == ruta_id)
        ).scalar_one_or_none()
        polyline: list[list[float]] | None = None
        if polyline_obj and polyline_obj.polyline:
            try:
                polyline = json.loads(polyline_obj.polyline)
            except (json.JSONDecodeError, TypeError):
                pass

        # Ako nema spremljenog polyline, generiraj on-the-fly i spremi za buduće pozive
        if not polyline:
            stop_coords = [(s["lat"], s["lng"]) for s in stop_details if s.get("lat") and s.get("lng")]
            if stop_coords:
                depot = self._get_depot_location(db)
                coords_for_geom = [depot] + stop_coords
                logger.info("Generiram on-the-fly polyline za rutu %d (%d waypoints)", ruta_id, len(coords_for_geom))
                polyline = distance_service.get_route_geometry(db, coords_for_geom)
                if polyline:
                    logger.info("Polyline generiran: %d koordinata, spremam u DB", len(polyline))
                    # Spremi za buduće pozive
                    polyline_json = json.dumps(polyline)
                    if polyline_obj:
                        polyline_obj.polyline = polyline_json
                    else:
                        db.add(RutaPolyline(
                            ruta_id=ruta_id,
                            polyline=polyline_json,
                            distance_km=ruta.distance_km,
                            duration_min=ruta.duration_min,
                        ))
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()
                        logger.warning("Nije moguće spremiti polyline za rutu %d", ruta_id)
                else:
                    logger.warning("Nije moguće generirati polyline za rutu %d", ruta_id)

        # Regije iz naloga
        regija_ids: set[int] = set()
        for stop in stops:
            for Model in (NalogHeaderRutiranje, NalogHeader):
                q = select(Model.regija_id).where(Model.nalog_prodaje_uid == stop.nalog_uid)
                rid = db.execute(q).scalar_one_or_none()
                if rid is not None:
                    regija_ids.add(rid)
                    break
            else:
                from app.models.routing_order_models import NalogHeaderArhiva as _NHA
                q = select(_NHA.regija_id).where(_NHA.nalog_prodaje_uid == stop.nalog_uid)
                rid = db.execute(q).scalar_one_or_none()
                if rid is not None:
                    regija_ids.add(rid)

        regije_str = None
        if regija_ids:
            from app.models.regional_models import Regija
            names = db.execute(
                select(Regija.naziv).where(Regija.id.in_(regija_ids)).order_by(Regija.naziv)
            ).scalars().all()
            if names:
                regije_str = ", ".join(names)

        return {
            "id": ruta.id,
            "datum": ruta.datum.isoformat() if ruta.datum else None,
            "raspored": ruta.raspored.isoformat() if ruta.raspored else None,
            "status": ruta.status,
            "algoritam": ruta.algoritam,
            "vozilo_id": ruta.vozilo_id,
            "vozilo_oznaka": vozilo.oznaka if vozilo else None,
            "vozac_id": ruta.vozac_id,
            "driver_name": driver_name,
            "warehouse_id": ruta.warehouse_id,
            "izvor_tip": ruta.izvor_tip,
            "izvor_id": ruta.izvor_id,
            "distance_km": float(ruta.distance_km) if ruta.distance_km else None,
            "duration_min": ruta.duration_min,
            "regije": regije_str,
            "stops": stop_details,
            "polyline": polyline,
        }


# Singleton
routing_service = RoutingService()
