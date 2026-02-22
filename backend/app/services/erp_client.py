"""
Luceed ERP API Client.

Svi pozivi koriste Basic Auth i vraćaju JSON.
Endpoint pattern: ERP_BASE_URL/datasnap/rest/...
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Any

import aiohttp

from app.core.config import settings

logger = logging.getLogger(__name__)


class ERPClient:
    """Async HTTP klijent za Luceed ERP REST API."""

    def __init__(self) -> None:
        self.base_url = settings.ERP_BASE_URL.rstrip("/")
        self._auth = aiohttp.BasicAuth(settings.ERP_USERNAME, settings.ERP_PASSWORD)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    async def _get(self, path: str, timeout_seconds: int | None = None) -> Any:
        """Izvršava GET zahtjev i vraća JSON odgovor."""
        url = f"{self.base_url}{path}"
        timeout = aiohttp.ClientTimeout(total=timeout_seconds or 60)
        logger.debug("ERP GET %s (timeout=%ss)", url, timeout.total)
        async with aiohttp.ClientSession(auth=self._auth) as session:
            async with session.get(url, timeout=timeout) as resp:
                resp.raise_for_status()
                return await resp.json()

    @staticmethod
    def _format_date(d: date) -> str:
        return d.strftime("%d.%m.%Y")

    # ------------------------------------------------------------------
    # Nalozi prodaje
    # ------------------------------------------------------------------
    async def get_nalozi_headers(
        self,
        statusi: list[str],
        datum_od: date,
        datum_do: date,
    ) -> list[dict[str, Any]]:
        """
        Dohvat headera naloga po statusima i rasponu datuma.

        GET /datasnap/rest/NaloziProdaje/statusi/[{statusi}]/DD.MM.YYYY/DD.MM.YYYY
        
        Vraća: {"result": [{"nalozi_prodaje": [...]}]}
        """
        statusi_str = ",".join(statusi)
        path = (
            f"/datasnap/rest/NaloziProdaje/statusi/[{statusi_str}]"
            f"/{self._format_date(datum_od)}/{self._format_date(datum_do)}"
        )
        data = await self._get(path)
        # ERP vraća {"result": [{"nalozi_prodaje": [...]}]}
        result = data.get("result", [])
        if result and isinstance(result, list) and len(result) > 0:
            nalozi = result[0].get("nalozi_prodaje", [])
            return nalozi if isinstance(nalozi, list) else []
        return []

    async def get_nalog_details(self, nalog_uid: str) -> dict[str, Any] | None:
        """
        Dohvat detalja naloga (header + stavke).

        GET /datasnap/rest/NaloziProdaje/uid/{nalog_prodaje_uid}
        
        Vraća: {"result": [{"nalozi_prodaje": [{...header..., "stavke": [...], "statusi": [...]}]}]}
        """
        path = f"/datasnap/rest/NaloziProdaje/uid/{nalog_uid}"
        data = await self._get(path)
        result = data.get("result", [])
        if result and isinstance(result, list) and len(result) > 0:
            nalozi = result[0].get("nalozi_prodaje", [])
            if nalozi and isinstance(nalozi, list) and len(nalozi) > 0:
                return nalozi[0]
        return None

    async def get_nalozi_izmjena_status(self, datum: date) -> list[dict[str, Any]]:
        """
        Dohvat naloga kojima se promijenio status od zadanog datuma.

        GET /datasnap/rest/NaloziProdaje/IzmjenaStatus/DD.MM.YYYY

        Vraća samo header podatke (uključujući status, raspored, partner_uid itd.).
        """
        path = f"/datasnap/rest/NaloziProdaje/IzmjenaStatus/{self._format_date(datum)}"
        data = await self._get(path)
        result = data.get("result", [])
        if result and isinstance(result, list) and len(result) > 0:
            nalozi = result[0].get("nalozi_prodaje", [])
            return nalozi if isinstance(nalozi, list) else []
        return []

    async def get_partner_by_uid(self, partner_uid: str) -> dict[str, Any] | None:
        """
        Dohvat partnera po UID-u.

        GET /datasnap/rest/partneri/uid/{partner_uid}
        """
        path = f"/datasnap/rest/partneri/uid/{partner_uid}"
        data = await self._get(path)
        result = data.get("result", [])
        if result and isinstance(result, list) and len(result) > 0:
            partner_list = result[0].get("partner", [])
            if partner_list and isinstance(partner_list, list) and len(partner_list) > 0:
                return partner_list[0]
        return None

    # ------------------------------------------------------------------
    # Partneri
    # ------------------------------------------------------------------
    async def get_partner(self, partner_sifra: str) -> dict[str, Any] | None:
        """
        Dohvat partnera po šifri.

        GET /datasnap/rest/partneri/sifra/{partner_sifra}
        
        Vraća: {"result": [{"partner": [...]}]}
        """
        path = f"/datasnap/rest/partneri/sifra/{partner_sifra}"
        data = await self._get(path)
        result = data.get("result", [])
        if result and isinstance(result, list) and len(result) > 0:
            partner_list = result[0].get("partner", [])
            if partner_list and isinstance(partner_list, list) and len(partner_list) > 0:
                return partner_list[0]
        return None

    # ------------------------------------------------------------------
    # Artikli
    # ------------------------------------------------------------------
    async def get_artikli_page(self, offset: int = 0, limit: int = 500) -> list[dict[str, Any]]:
        """
        Dohvat stranice artikala.

        GET /datasnap/rest/artikli/lista/[{offset},{limit}]

        Timeout kao u TestPodaciPrimjeri: veći batch = duži timeout (ERP dugo vraća).
        """
        path = f"/datasnap/rest/artikli/lista/[{offset},{limit}]"
        if limit >= 1000:
            timeout_seconds = 180  # 3 minute za batch 1000+
        elif limit >= 500:
            timeout_seconds = 120  # 2 minute za 500–999
        else:
            timeout_seconds = 60
        data = await self._get(path, timeout_seconds=timeout_seconds)
        # Struktura: {"result": [{"artikli": [ {...}, {...} ]}]}
        result = data.get("result", [])
        if result and isinstance(result, list) and len(result) > 0:
            artikli = result[0].get("artikli", [])
            return artikli if isinstance(artikli, list) else []
        return []

    async def get_artikl(self, artikl_uid: str) -> dict[str, Any] | None:
        """
        Dohvat pojedinačnog artikla.

        GET /datasnap/rest/artikli/uid/{artikl_uid}
        """
        path = f"/datasnap/rest/artikli/uid/{artikl_uid}"
        data = await self._get(path)
        # Očekujemo istu strukturu kao u staroj aplikaciji:
        # {"result": [{"artikli": [ {...} ]}]}
        result = data.get("result", [])
        if result and isinstance(result, list) and len(result) > 0:
            artikli = result[0].get("artikli", [])
            if isinstance(artikli, list) and len(artikli) > 0:
                return artikli[0]
        return None

    async def get_all_artikli(self, page_size: int = 500) -> list[dict[str, Any]]:
        """Dohvat svih artikala iteriranjem po stranicama."""
        all_items: list[dict[str, Any]] = []
        offset = 0
        while True:
            page = await self.get_artikli_page(offset, page_size)
            if not page:
                break
            all_items.extend(page)
            if len(page) < page_size:
                break
            offset += page_size
            await asyncio.sleep(0.1)  # mali delay između stranica
        return all_items


# Singleton instanca
erp_client = ERPClient()
