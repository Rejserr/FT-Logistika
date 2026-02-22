"""
Geocoding servis s DB cache-om.

Podržava OpenRouteService (ORS), Google Maps, Nominatim i TomTom kao providere.
Provider se odabire preko DB settings tablice (key: 'geocoding_provider').
Uključuje čišćenje adresa i multi-provider fallback za bolje rezultate.
"""
from __future__ import annotations

import hashlib
import logging
import re
from decimal import Decimal
from typing import NamedTuple

import aiohttp
import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.models.sync_models import GeocodingCache

logger = logging.getLogger(__name__)


# =============================================================================
# Čišćenje / normalizacija adresa za bolje geocoding rezultate
# =============================================================================

def _clean_address(address: str) -> str:
    """
    Očisti adresu za bolje geocoding rezultate.
    Primjeri problema:
      - "RIMSKE CENT. 30" -> "RIMSKE CESTE 30"
      - "Dr.Franje Tuđmana 134 ( Pokupska 53 )" -> "Dr. Franje Tuđmana 134"
      - "F.PUŠKARIČEVA 65" -> "F. PUŠKARIČEVA 65"
      - "Nova Dalmacija 19 A, JOSIPOVAC, 31221, HR" -> ukloni poštanski broj
    """
    cleaned = address.strip()

    # 1. Ukloni sadržaj u zagradama (alternativne adrese zbunjuju geocoder)
    cleaned = re.sub(r'\s*\([^)]*\)\s*', ' ', cleaned)

    # 2. Poštanski broj ZADRŽAVAMO — pomaže razlikovati mjesta s istim ulicama
    #    (npr. I. Mažuranića postoji i u Samoboru i u Osijeku)

    # 3. Ukloni kratice država na kraju (HR, SI, BA...) - zamijenjeno punim nazivom drugdje
    cleaned = re.sub(r',\s*\b(HR|SI|BA|RS|HU|AT)\b\s*$', '', cleaned)

    # 4. Proširi uobičajene skraćenice ulica
    abbreviations = {
        r'\bCENT\.?\b': 'CESTE',
        r'\bUL\.?\b': 'ULICA',
        r'\bBR\.?\b': 'BROJ',
        r'\bBB\.?\b': 'BB',
        r'\bSV\.?\b': 'SVETOG',
    }
    for pattern, replacement in abbreviations.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    # 5. Dodaj razmak nakon točke u skraćenicama (F.PUŠKARIČEVA -> F. PUŠKARIČEVA)
    cleaned = re.sub(r'([A-Za-zčćžšđČĆŽŠĐ])\.([A-Za-zčćžšđČĆŽŠĐ])', r'\1. \2', cleaned)

    # 6. Očisti duple razmake
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # 7. Ukloni trailing zareze
    cleaned = cleaned.rstrip(',').strip()

    return cleaned


def _simplify_address(address: str) -> str | None:
    """
    Simplificirana verzija adrese - samo mjesto i država.
    Koristi se kao fallback kad puna adresa ne radi.
    Npr. "I. MAŽURANIĆA 63, Samobor, 10430, Hrvatska" -> "Samobor, Hrvatska"
    """
    parts = [p.strip() for p in address.split(',') if p.strip()]
    # Filtriraj čiste poštanske brojeve (samo znamenke)
    non_postal = [p for p in parts if not re.match(r'^\d{4,5}$', p.strip())]
    if len(non_postal) >= 2:
        return ', '.join(non_postal[-2:])
    if len(parts) >= 2:
        return ', '.join(parts[-2:])
    return None


def _make_address_variants(address: str) -> list[str]:
    """
    Generiraj varijante adrese za probavanje.
    Vraća listu od najspecifičnije do najopćenitije.
    """
    variants = []

    # 1. Očišćena puna adresa
    cleaned = _clean_address(address)
    if cleaned and cleaned != address:
        variants.append(cleaned)

    # 2. Originalna adresa (ako je drugačija od cleaned)
    variants.append(address)

    # 3. Simplificirana (samo mjesto + država)
    simplified = _simplify_address(cleaned or address)
    if simplified:
        variants.append(simplified)

    # Dedupliciraj čuvajući redoslijed
    seen: set[str] = set()
    unique: list[str] = []
    for v in variants:
        key = v.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(v)

    return unique


class GeocodingResult(NamedTuple):
    """Rezultat geocodinga."""
    lat: Decimal | None
    lng: Decimal | None
    formatted_address: str | None
    from_cache: bool


def _get_provider(db: Session) -> str:
    """Dohvati aktivni geocoding provider iz DB settings."""
    from app.models.config_models import Setting
    from sqlalchemy import func as sqlfunc
    row = db.execute(
        select(Setting).where(sqlfunc.upper(Setting.key) == "GEOCODING_PROVIDER")
    ).scalar_one_or_none()
    if row and row.value:
        return row.value.strip().lower()
    # Default: ORS ako ima ključ, inače TomTom, google, nominatim
    if app_settings.ORS_API_KEY:
        return "ors"
    if app_settings.TOMTOM_API_KEY:
        return "tomtom"
    if app_settings.GOOGLE_MAPS_API_KEY:
        return "google"
    return "nominatim"


class GeocodingService:
    """Servis za geocoding adresa s DB cache-om i više providera."""

    @staticmethod
    def _hash_address(address: str) -> str:
        normalized = address.lower().strip()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def _get_from_cache(self, db: Session, address: str) -> GeocodingCache | None:
        address_hash = self._hash_address(address)
        return db.execute(
            select(GeocodingCache).where(GeocodingCache.address_hash == address_hash)
        ).scalar_one_or_none()

    def _save_to_cache(
        self, db: Session, address: str, lat: Decimal | None, lng: Decimal | None, provider: str,
    ) -> GeocodingCache:
        address_hash = self._hash_address(address)
        cache_entry = GeocodingCache(
            address_hash=address_hash, address=address, lat=lat, lng=lng, provider=provider,
        )
        db.add(cache_entry)
        db.commit()
        db.refresh(cache_entry)
        return cache_entry

    # -------------------------------------------------------------------------
    # Provider implementations
    # -------------------------------------------------------------------------

    def _geocode_nominatim(self, address: str) -> GeocodingResult:
        """Besplatni Nominatim (OpenStreetMap) geocoding -- nema API ključa."""
        try:
            resp = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": address,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "hr",
                    "accept-language": "hr",
                },
                headers={"User-Agent": "FT-Logistika/1.0"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if data:
                lat = Decimal(data[0]["lat"])
                lng = Decimal(data[0]["lon"])
                display = data[0].get("display_name", address)
                return GeocodingResult(lat=lat, lng=lng, formatted_address=display, from_cache=False)
            return GeocodingResult(None, None, None, False)
        except Exception as e:
            logger.exception("Nominatim geocoding error for %s: %s", address[:50], e)
            return GeocodingResult(None, None, None, False)

    def _geocode_ors(self, address: str) -> GeocodingResult:
        """OpenRouteService geocoding (Pelias)."""
        api_key = app_settings.ORS_API_KEY
        if not api_key:
            logger.warning("ORS API ključ nije konfiguriran, fallback na Nominatim")
            return self._geocode_nominatim(address)
        try:
            resp = requests.get(
                "https://api.openrouteservice.org/geocode/search",
                params={
                    "api_key": api_key,
                    "text": address,
                    "boundary.country": "HR",
                    "size": 1,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                coords = features[0]["geometry"]["coordinates"]  # [lng, lat]
                props = features[0].get("properties", {})
                lat = Decimal(str(coords[1]))
                lng = Decimal(str(coords[0]))
                label = props.get("label", address)
                return GeocodingResult(lat=lat, lng=lng, formatted_address=label, from_cache=False)
            return GeocodingResult(None, None, None, False)
        except Exception as e:
            logger.exception("ORS geocoding error for %s: %s", address[:50], e)
            return GeocodingResult(None, None, None, False)

    def _geocode_google(self, address: str) -> GeocodingResult:
        """Google Maps geocoding."""
        api_key = app_settings.GOOGLE_MAPS_API_KEY
        if not api_key:
            logger.warning("Google Maps API ključ nije konfiguriran")
            return GeocodingResult(None, None, None, False)
        try:
            import googlemaps
            gmaps = googlemaps.Client(key=api_key)
            results = gmaps.geocode(address, region="hr", language="hr")
            if results:
                location = results[0]["geometry"]["location"]
                lat = Decimal(str(location["lat"]))
                lng = Decimal(str(location["lng"]))
                formatted = results[0].get("formatted_address", address)
                return GeocodingResult(lat=lat, lng=lng, formatted_address=formatted, from_cache=False)
            return GeocodingResult(None, None, None, False)
        except Exception as e:
            logger.exception("Google geocoding error for %s: %s", address[:50], e)
            return GeocodingResult(None, None, None, False)

    def _geocode_tomtom(self, address: str) -> GeocodingResult:
        """TomTom Geocode API – podržava HR i SI."""
        api_key = app_settings.TOMTOM_API_KEY
        if not api_key:
            logger.warning("TomTom API ključ nije konfiguriran, fallback na Nominatim")
            return self._geocode_nominatim(address)
        try:
            from urllib.parse import quote
            encoded_query = quote(address, safe="")
            resp = requests.get(
                f"https://api.tomtom.com/search/2/geocode/{encoded_query}.json",
                params={
                    "key": api_key,
                    "countrySet": "HR,SI",
                    "limit": 1,
                    "language": "hr-HR",
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if results:
                position = results[0].get("position", {})
                lat = Decimal(str(position["lat"]))
                lng = Decimal(str(position["lon"]))
                addr_info = results[0].get("address", {})
                label = addr_info.get("freeformAddress", address)
                return GeocodingResult(lat=lat, lng=lng, formatted_address=label, from_cache=False)
            return GeocodingResult(None, None, None, False)
        except Exception as e:
            logger.exception("TomTom geocoding error for %s: %s", address[:50], e)
            return GeocodingResult(None, None, None, False)

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def _try_geocode(self, address: str, provider: str) -> GeocodingResult:
        """Pokušaj geocodirati s jednim providerom."""
        if provider == "google":
            return self._geocode_google(address)
        elif provider == "ors":
            return self._geocode_ors(address)
        elif provider == "tomtom":
            return self._geocode_tomtom(address)
        else:
            return self._geocode_nominatim(address)

    def geocode(self, db: Session, address: str) -> GeocodingResult:
        """
        Geocodiraj adresu s pametnim fallback-om:
        1. Provjeri DB cache (ali preskoči NULL cache - dopusti retry)
        2. Očisti adresu i generiraj varijante
        3. Za svaku varijantu probaj primarni provider
        4. Ako ništa ne uspije, probaj Nominatim kao fallback
        5. Spremi u cache (samo uspješne rezultate)
        """
        if not address or not address.strip():
            return GeocodingResult(None, None, None, False)

        # 1. Cache - ali samo ako ima koordinate (NULL cache preskaćemo za retry)
        cached = self._get_from_cache(db, address)
        if cached and cached.lat is not None and cached.lng is not None:
            return GeocodingResult(lat=cached.lat, lng=cached.lng, formatted_address=cached.address, from_cache=True)

        # 2. Provider i varijante adrese
        provider = _get_provider(db)
        variants = _make_address_variants(address)
        logger.info("Geocoding '%s' sa providerom: %s (%d varijanti)", address[:60], provider, len(variants))

        # 3. Probaj svaku varijantu s primarnim providerom
        best_result: GeocodingResult | None = None
        for i, variant in enumerate(variants):
            result = self._try_geocode(variant, provider)
            if result.lat is not None:
                logger.info("Geocoded varijanta %d: '%s' -> (%s, %s) [%s]",
                            i + 1, variant[:50], result.lat, result.lng, provider)
                best_result = result
                break

        # 4. Fallback na Nominatim ako primarni nije uspio (i primarni nije vec Nominatim)
        if not best_result and provider != "nominatim":
            logger.info("Fallback na Nominatim za '%s'", address[:50])
            for variant in variants:
                result = self._geocode_nominatim(variant)
                if result.lat is not None:
                    logger.info("Nominatim fallback uspio: '%s' -> (%s, %s)",
                                variant[:50], result.lat, result.lng)
                    best_result = result
                    provider = "nominatim"
                    break

        # 5. Cache - spremi rezultat
        if best_result and best_result.lat is not None:
            # Obriši stari NULL cache ako postoji
            if cached and cached.lat is None:
                db.delete(cached)
                db.flush()
            self._save_to_cache(db, address, best_result.lat, best_result.lng, provider)
            return best_result
        else:
            # Spremi NULL samo ako ne postoji zapis (da ne dupliciramo)
            if not cached:
                self._save_to_cache(db, address, None, None, provider)
            logger.warning("Geocoding NEUSPJEH za sve varijante: %s [%s]", address[:60], provider)
            return GeocodingResult(None, None, None, False)

    def geocode_batch(self, db: Session, addresses: list[str]) -> dict[str, GeocodingResult]:
        results: dict[str, GeocodingResult] = {}
        for addr in addresses:
            results[addr] = self.geocode(db, addr)
        return results


# Singleton
geocoding_service = GeocodingService()
