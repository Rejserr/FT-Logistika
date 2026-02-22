"""
Async Luceed ERP API client
"""
import aiohttp
import asyncio
from typing import List, Dict, Optional, Any
from datetime import datetime, date
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class ERPClient:
    """Async client for Luceed ERP API"""
    
    def __init__(self):
        self.base_url = settings.ERP_BASE_URL
        self.username = settings.ERP_USERNAME
        self.password = settings.ERP_PASSWORD
        # Default timeout - povećan za veće batch-ove
        self.timeout = aiohttp.ClientTimeout(total=120)  # Default timeout - 2 minute
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            auth = aiohttp.BasicAuth(self.username, self.password)
            self._session = aiohttp.ClientSession(
                auth=auth,
                timeout=self.timeout,
                connector=aiohttp.TCPConnector(limit=100, limit_per_host=10)
            )
        return self._session
    
    async def close(self):
        """Close session"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def _request(self, endpoint: str, method: str = "GET", custom_timeout: Optional[aiohttp.ClientTimeout] = None) -> Dict[str, Any]:
        """
        Make async HTTP request to ERP API
        """
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        
        # Koristi custom timeout ako je zadan, inače koristi session timeout
        timeout = custom_timeout if custom_timeout is not None else None
        
        try:
            async with session.request(method, url, timeout=timeout) as response:
                # Log response status and details
                logger.debug(f"ERP API request: {url}, Status: {response.status}")
                
                # Try to get response text for better error messages
                if response.status >= 400:
                    response_text = await response.text()
                    logger.error(f"ERP API error for {endpoint}: HTTP {response.status} - {response_text[:500]}")
                    response.raise_for_status()
                
                data = await response.json()
                return data
        except aiohttp.ClientError as e:
            logger.error(f"ERP API client error for {endpoint}: {type(e).__name__}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error for {endpoint}: {type(e).__name__}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise
    
    async def get_nalozi_headers(
        self, 
        statusi: List[str], 
        datum_od: date, 
        datum_do: date
    ) -> List[Dict[str, Any]]:
        """
        Get nalozi headers by status and date range
        
        Endpoint: /NaloziProdaje/statusi/[08,101,102,103]/15.01.2026/15.01.2026
        """
        statusi_str = ",".join(statusi)
        datum_od_str = datum_od.strftime("%d.%m.%Y")
        datum_do_str = datum_do.strftime("%d.%m.%Y")
        
        endpoint = f"/datasnap/rest/NaloziProdaje/statusi/[{statusi_str}]/{datum_od_str}/{datum_do_str}"
        
        data = await self._request(endpoint)
        
        # Extract nalozi from response structure
        nalozi = []
        if "result" in data and len(data["result"]) > 0:
            if "nalozi_prodaje" in data["result"][0]:
                nalozi = data["result"][0]["nalozi_prodaje"]
        
        return nalozi
    
    async def get_nalog_details(self, nalog_prodaje_uid: str) -> Optional[Dict[str, Any]]:
        """
        Get nalog details with stavke
        
        Endpoint: /NaloziProdaje/uid/{nalog_prodaje_uid}
        """
        endpoint = f"/datasnap/rest/NaloziProdaje/uid/{nalog_prodaje_uid}"
        
        data = await self._request(endpoint)
        
        # Extract nalog from response structure
        if "result" in data and len(data["result"]) > 0:
            if "nalozi_prodaje" in data["result"][0] and len(data["result"][0]["nalozi_prodaje"]) > 0:
                return data["result"][0]["nalozi_prodaje"][0]
        
        return None
    
    async def get_artikli_list(self, offset: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get artikli list with pagination
        
        Endpoint: /artikli/lista/[offset,limit]
        """
        endpoint = f"/datasnap/rest/artikli/lista/[{offset},{limit}]"
        
        try:
            # Dinamički timeout ovisno o batch size-u
            # Veći batch = duži timeout
            if limit >= 1000:
                timeout_seconds = 180  # 3 minute za batch od 1000+
            elif limit >= 500:
                timeout_seconds = 120  # 2 minute za batch od 500-999
            else:
                timeout_seconds = 60   # 1 minuta za manje batch-ove
            
            # Kreiraj custom timeout za ovaj zahtjev
            custom_timeout = aiohttp.ClientTimeout(total=timeout_seconds)
            logger.debug(f"Using timeout {timeout_seconds}s for batch size {limit} at offset {offset}")
            
            data = await self._request(endpoint, custom_timeout=custom_timeout)
            
            # Extract artikli from response structure
            artikli = []
            if "result" in data and len(data["result"]) > 0:
                if "artikli" in data["result"][0]:
                    artikli = data["result"][0]["artikli"]
            
            return artikli
        except Exception as e:
            logger.error(f"Error in get_artikli_list for offset {offset}, limit {limit}: {e}")
            raise
    
    async def get_partner_by_sifra(self, partner_sifra: str) -> Optional[Dict[str, Any]]:
        """
        Get partner by šifra
        
        Endpoint: /partneri/sifra/{partner_sifra}
        """
        endpoint = f"/datasnap/rest/partneri/sifra/{partner_sifra}"
        
        data = await self._request(endpoint)
        
        # Extract partner from response structure
        if "result" in data and len(data["result"]) > 0:
            if "partner" in data["result"][0] and len(data["result"][0]["partner"]) > 0:
                return data["result"][0]["partner"][0]
        
        return None
    
    async def get_artikl_by_uid(self, artikl_uid: str) -> Optional[Dict[str, Any]]:
        """
        Get single artikl by UID
        
        Endpoint: /artikli/uid/{artikl_uid}
        """
        endpoint = f"/datasnap/rest/artikli/uid/{artikl_uid}"
        
        data = await self._request(endpoint)
        
        # Pretpostavljamo da ERP vraća strukturu slično ostalim pozivima:
        # { "result": [ { "artikli": [ { ... } ] } ] }
        if "result" in data and len(data["result"]) > 0:
            first = data["result"][0]
            if "artikli" in first and len(first["artikli"]) > 0:
                return first["artikli"][0]
        return None
    
    async def fetch_multiple_nalozi_details(
        self, 
        nalog_uids: List[str], 
        max_concurrent: int = 10
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetch multiple nalog details concurrently with semaphore limit
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        results = {}
        
        async def fetch_one(uid: str):
            async with semaphore:
                try:
                    details = await self.get_nalog_details(uid)
                    if details:
                        results[uid] = details
                except Exception as e:
                    logger.error(f"Error fetching nalog {uid}: {e}")
                    results[uid] = None
        
        tasks = [fetch_one(uid) for uid in nalog_uids]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        return results
    
    async def fetch_multiple_partners(
        self, 
        partner_sifre: List[str], 
        max_concurrent: int = 10
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetch multiple partners concurrently with semaphore limit
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        results = {}
        
        async def fetch_one(sifra: str):
            async with semaphore:
                try:
                    partner = await self.get_partner_by_sifra(sifra)
                    if partner:
                        results[sifra] = partner
                except Exception as e:
                    logger.error(f"Error fetching partner {sifra}: {e}")
                    results[sifra] = None
        
        tasks = [fetch_one(sifra) for sifra in partner_sifre]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        return results


# Global client instance
_erp_client: Optional[ERPClient] = None


def get_erp_client() -> ERPClient:
    """Get or create global ERP client instance"""
    global _erp_client
    if _erp_client is None:
        _erp_client = ERPClient()
    return _erp_client
