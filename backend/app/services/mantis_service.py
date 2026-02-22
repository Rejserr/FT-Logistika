"""
Mantis WMS servis za sinkronizaciju SSCC podataka iz LVision baze.

Čita view v_CST_OrderProgress sa Mantis SQL Servera i cacheira
podatke u lokalnu tablicu mantis_sscc.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, select, text, func as sa_func
from sqlalchemy.orm import Session

from app.models.erp_models import NalogHeader
from app.models.mantis_models import MantisSSCC
from app.models.routing_models import Ruta, RutaStop
from app.models.routing_order_models import NalogHeaderRutiranje

logger = logging.getLogger(__name__)

# Koliko minuta stari podaci su "svježi" pa ih ne treba ponovo dohvaćati
CACHE_FRESHNESS_MINUTES = 5


class MantisService:
    """Servis za komunikaciju s Mantis WMS-om i upravljanje SSCC podacima."""

    # ------------------------------------------------------------------
    # Pomoćne metode
    # ------------------------------------------------------------------

    @staticmethod
    def _make_order_code(broj: int | None, skladiste: str | None) -> str | None:
        """Generiraj WMS OrderCode iz broja naloga i skladišta."""
        if broj is None or skladiste is None:
            return None
        return f"{broj}-{skladiste}"

    def _get_order_codes_for_nalozi(
        self, db: Session, nalog_uids: list[str] | None = None, statuses: list[str] | None = None
    ) -> dict[str, str]:
        """
        Dohvati mapiranje nalog_prodaje_uid -> OrderCode.

        Traži u obje tablice: nalozi_header i nalozi_header_rutiranje.
        """
        if statuses is None:
            statuses = ["103", "30"]

        uid_to_code: dict[str, str] = {}

        # Iz originalne tablice
        q1 = select(NalogHeader.nalog_prodaje_uid, NalogHeader.broj, NalogHeader.skladiste)
        if nalog_uids:
            q1 = q1.where(NalogHeader.nalog_prodaje_uid.in_(nalog_uids))
        else:
            q1 = q1.where(NalogHeader.status.in_(statuses))
        for uid, broj, skladiste in db.execute(q1):
            code = self._make_order_code(broj, skladiste)
            if code:
                uid_to_code[uid] = code

        # Iz rutiranja tablice
        q2 = select(
            NalogHeaderRutiranje.nalog_prodaje_uid,
            NalogHeaderRutiranje.broj,
            NalogHeaderRutiranje.skladiste,
        )
        if nalog_uids:
            q2 = q2.where(NalogHeaderRutiranje.nalog_prodaje_uid.in_(nalog_uids))
        else:
            q2 = q2.where(NalogHeaderRutiranje.status.in_(statuses))
        for uid, broj, skladiste in db.execute(q2):
            code = self._make_order_code(broj, skladiste)
            if code:
                uid_to_code[uid] = code

        return uid_to_code

    # ------------------------------------------------------------------
    # Sync iz WMS-a
    # ------------------------------------------------------------------

    def sync_orders_from_wms(
        self,
        db: Session,
        mantis_db: Session,
        nalog_uids: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Sinkroniziraj SSCC podatke iz Mantis WMS-a.

        Args:
            db: lokalna FTLogistika sesija
            mantis_db: Mantis WMS sesija (read-only)
            nalog_uids: opcijsko — sync samo za ove naloge

        Returns:
            dict sa statistikom synca
        """
        uid_to_code = self._get_order_codes_for_nalozi(db, nalog_uids)
        if not uid_to_code:
            logger.info("Nema naloga za WMS sync")
            return {"synced_orders": 0, "total_items": 0, "total_pallets": 0}

        # Obrni mapiranje: code -> uid
        code_to_uid: dict[str, str] = {v: k for k, v in uid_to_code.items()}
        order_codes = list(code_to_uid.keys())

        logger.info("WMS sync: %d naloga, OrderCodes: %s", len(order_codes), order_codes[:10])

        # Batch query na WMS — čitamo iz viewa
        now = datetime.utcnow()
        total_items = 0
        total_pallets_set: set[str] = set()

        # Batch po 50 kodova (SQL IN limit)
        batch_size = 50
        all_wms_rows: list[dict] = []
        for i in range(0, len(order_codes), batch_size):
            batch = order_codes[i : i + batch_size]
            placeholders = ", ".join(f":p{j}" for j in range(len(batch)))
            params = {f"p{j}": code for j, code in enumerate(batch)}

            sql = text(
                f"SELECT * FROM v_CST_OrderProgress (NOLOCK) WHERE OrderCode IN ({placeholders})"
            )
            try:
                result = mantis_db.execute(sql, params)
                columns = list(result.keys())
                for row in result:
                    row_dict = dict(zip(columns, row))
                    all_wms_rows.append(row_dict)
            except Exception as exc:
                logger.error("Greška pri čitanju WMS-a (batch %d): %s", i, exc)
                continue

        logger.info("WMS vratio %d redaka za %d naloga", len(all_wms_rows), len(order_codes))

        # Obriši stare cache zapise za ove OrderCode-ove
        if order_codes:
            db.execute(
                delete(MantisSSCC).where(MantisSSCC.order_code.in_(order_codes))
            )

        # Insertiraj nove
        for row in all_wms_rows:
            order_code = row.get("OrderCode", "")
            nalog_uid = code_to_uid.get(order_code)
            sscc_val = row.get("SSCC")

            sscc_record = MantisSSCC(
                order_code=order_code,
                nalog_prodaje_uid=nalog_uid,
                order_shipment_code=row.get("OrderShipmentCode"),
                product_id=row.get("ProductID"),
                product=row.get("Product"),
                quantity=row.get("Quantity"),
                item_status_id=row.get("ItemStatusID"),
                item_status_code=row.get("ItemStatusCode"),
                item_status_code2=row.get("ItemStatusCode2"),
                item_status=row.get("ItemStatus"),
                zone=row.get("Zone"),
                zone_id=row.get("ZoneID"),
                location=row.get("Location"),
                sscc=sscc_val,
                psscc=row.get("PSSCC"),
                order_shipment_status_id=row.get("OrderShipmentStatusID"),
                order_shipment_status_code=row.get("OrderShipmentStatusCode"),
                order_shipment_status=row.get("OrderShipmentStatus"),
                customer=row.get("Customer"),
                receiver=row.get("Receiver"),
                memo=row.get("Memo"),
                assigned_user=row.get("AssignedUser"),
                agency=row.get("Agency"),
                city=row.get("City"),
                synced_at=now,
            )
            db.add(sscc_record)
            total_items += 1
            if sscc_val:
                total_pallets_set.add(f"{order_code}:{sscc_val}")

        db.commit()

        stats = {
            "synced_orders": len(order_codes),
            "total_items": total_items,
            "total_pallets": len(total_pallets_set),
        }
        logger.info("WMS sync završen: %s", stats)
        return stats

    # ------------------------------------------------------------------
    # Dohvat SSCC podataka za jedan nalog
    # ------------------------------------------------------------------

    def get_sscc_for_order(
        self,
        db: Session,
        nalog_prodaje_uid: str,
        mantis_db: Session | None = None,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        """
        Dohvati SSCC podatke za jedan nalog.

        Implementira lazy sync: ako su podaci stariji od CACHE_FRESHNESS_MINUTES,
        automatski ih osvježava iz WMS-a.
        """
        # Provjeri svježinu cache-a
        cached = db.execute(
            select(MantisSSCC)
            .where(MantisSSCC.nalog_prodaje_uid == nalog_prodaje_uid)
            .limit(1)
        ).scalar_one_or_none()

        stale = True
        if cached and not force_refresh:
            age = datetime.utcnow() - cached.synced_at
            if age < timedelta(minutes=CACHE_FRESHNESS_MINUTES):
                stale = False

        # Lazy refresh ako su podaci stari
        if stale and mantis_db is not None:
            try:
                self.sync_orders_from_wms(db, mantis_db, nalog_uids=[nalog_prodaje_uid])
            except Exception as exc:
                logger.warning("Lazy WMS sync greška za %s: %s", nalog_prodaje_uid, exc)

        # Dohvati iz cache-a
        items = db.execute(
            select(MantisSSCC)
            .where(MantisSSCC.nalog_prodaje_uid == nalog_prodaje_uid)
            .order_by(MantisSSCC.product)
        ).scalars().all()

        return self._build_order_summary(nalog_prodaje_uid, items)

    # ------------------------------------------------------------------
    # Bulk dohvat za više naloga
    # ------------------------------------------------------------------

    def get_sscc_summary_for_orders(
        self,
        db: Session,
        nalog_uids: list[str],
        mantis_db: Session | None = None,
    ) -> dict[str, dict[str, Any]]:
        """
        Bulk dohvat SSCC sažetaka za više naloga.

        Ako je mantis_db dostupan, automatski sincira naloge
        koji nemaju cache ili im je cache star.
        """
        if not nalog_uids:
            return {}

        # Provjeri koji nalozi nemaju cache ili im je cache star
        if mantis_db is not None:
            cached_uids_rows = db.execute(
                select(MantisSSCC.nalog_prodaje_uid, sa_func.min(MantisSSCC.synced_at))
                .where(MantisSSCC.nalog_prodaje_uid.in_(nalog_uids))
                .group_by(MantisSSCC.nalog_prodaje_uid)
            ).all()

            cached_map = {row[0]: row[1] for row in cached_uids_rows}
            now = datetime.utcnow()
            stale_uids: list[str] = []

            for uid in nalog_uids:
                synced = cached_map.get(uid)
                if synced is None or (now - synced) > timedelta(minutes=CACHE_FRESHNESS_MINUTES):
                    stale_uids.append(uid)

            if stale_uids:
                logger.info("Bulk lazy sync za %d naloga bez/sa starim cache-om", len(stale_uids))
                try:
                    self.sync_orders_from_wms(db, mantis_db, nalog_uids=stale_uids)
                except Exception as exc:
                    logger.warning("Bulk lazy WMS sync greška: %s", exc)

        items = db.execute(
            select(MantisSSCC)
            .where(MantisSSCC.nalog_prodaje_uid.in_(nalog_uids))
            .order_by(MantisSSCC.nalog_prodaje_uid, MantisSSCC.product)
        ).scalars().all()

        # Grupiraj po nalog_uid
        grouped: dict[str, list[MantisSSCC]] = {}
        for item in items:
            uid = item.nalog_prodaje_uid
            if uid not in grouped:
                grouped[uid] = []
            grouped[uid].append(item)

        result: dict[str, dict[str, Any]] = {}
        for uid in nalog_uids:
            order_items = grouped.get(uid, [])
            result[uid] = self._build_order_summary(uid, order_items)

        return result

    # ------------------------------------------------------------------
    # Pallet count za rutu
    # ------------------------------------------------------------------

    def get_pallet_count_for_route(self, db: Session, ruta_id: int) -> dict[str, Any]:
        """Dohvati ukupan SSCC pallet count za sve naloge na ruti."""
        stops = db.execute(
            select(RutaStop.nalog_uid)
            .where(RutaStop.ruta_id == ruta_id)
        ).scalars().all()

        if not stops:
            return {"total_pallets": 0, "per_stop": {}}

        items = db.execute(
            select(MantisSSCC)
            .where(MantisSSCC.nalog_prodaje_uid.in_(stops))
        ).scalars().all()

        # Grupiraj po nalog
        grouped: dict[str, list[MantisSSCC]] = {}
        for item in items:
            uid = item.nalog_prodaje_uid
            if uid not in grouped:
                grouped[uid] = []
            grouped[uid].append(item)

        total_sscc: set[str] = set()
        per_stop: dict[str, int] = {}

        for uid in stops:
            order_items = grouped.get(uid, [])
            sscc_set = {it.sscc for it in order_items if it.sscc}
            per_stop[uid] = len(sscc_set)
            total_sscc.update(sscc_set)

        return {
            "total_pallets": len(total_sscc),
            "per_stop": per_stop,
        }

    # ------------------------------------------------------------------
    # Helper: build order summary
    # ------------------------------------------------------------------

    @staticmethod
    def _build_order_summary(
        nalog_uid: str | None, items: list[MantisSSCC]
    ) -> dict[str, Any]:
        """Izgradi sažetak SSCC podataka za jedan nalog."""
        # Count distinct SSCC kodova (samo ne-NULL)
        sscc_set = {it.sscc for it in items if it.sscc}
        total_paleta = len(sscc_set)

        # is_complete = True ako sve stavke imaju SSCC
        has_items = len(items) > 0
        all_have_sscc = has_items and all(it.sscc for it in items)

        # Odredi order_code
        order_code = items[0].order_code if items else None

        # synced_at
        synced_at = None
        if items:
            synced_at = items[0].synced_at.isoformat() if items[0].synced_at else None

        return {
            "nalog_prodaje_uid": nalog_uid,
            "order_code": order_code,
            "items": [
                {
                    "id": it.id,
                    "order_code": it.order_code,
                    "product_id": it.product_id,
                    "product": it.product,
                    "quantity": float(it.quantity) if it.quantity else None,
                    "item_status_id": it.item_status_id,
                    "item_status": it.item_status,
                    "sscc": it.sscc,
                    "psscc": it.psscc,
                    "location": it.location,
                    "zone": it.zone,
                }
                for it in items
            ],
            "total_paleta": total_paleta,
            "is_complete": all_have_sscc,
            "has_data": has_items,
            "synced_at": synced_at,
        }


# Singleton
mantis_service = MantisService()
