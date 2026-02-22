import logging
from typing import Any, Dict, List, Optional

from aiohttp import ClientSession, ClientTimeout

from app.config import settings


logger = logging.getLogger(__name__)


class OptimoClient:
    """Klijent za slanje naloga prema OptimoRoute API-ju."""

    @staticmethod
    async def send_order(order_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Pošalji jedan order prema OptimoRoute `create_order` endpointu.

        Vraća dict sa statusom HTTP odgovora i tijelom (ako je JSON).
        """
        if not settings.OPTIMO_API_KEY:
            raise RuntimeError("OPTIMO_API_KEY nije konfiguriran u .env datoteci")

        base_url = settings.OPTIMO_API_BASE_URL.rstrip("/")
        url = f"{base_url}/create_order?key={settings.OPTIMO_API_KEY}"

        timeout = ClientTimeout(total=30)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(url, json=order_payload) as response:
                text = await response.text()
                try:
                    data = await response.json()
                except Exception:
                    data = {"raw": text}

                success = data.get("success", False) if isinstance(data, dict) else False

                if not success or response.status != 200:
                    logger.error(
                        "OptimoRoute error: status=%s body=%s", response.status, text
                    )

                return {
                    "http_status": response.status,
                    "success": success,
                    "response": data,
                }

