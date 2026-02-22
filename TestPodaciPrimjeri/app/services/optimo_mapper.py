"""
OptimoRoute mapper - generira JSON payload za OptimoRoute API
"""
from sqlalchemy.orm import Session
from app.models.erp_models import NaloziHeader, Partneri
from app.models.regional_models import Regije
from app.models.optimo_models import OptimoOrders
from typing import Dict, Any, Optional
import json
import logging

logger = logging.getLogger(__name__)


class OptimoMapper:
    """Service za mapiranje naloga u OptimoRoute format"""
    
    @staticmethod
    def generate_payload(
        nalog_uid: str,
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """
        Generira OptimoRoute order payload za nalog.
        
        Mapping:
        - id → nalog_prodaje_uid
        - date → raspored
        - location.name → partner naziv ili ime + prezime
        - location.address → partner adresa
        - location.postcode → postanski_broj
        - location.city → naziv_mjesta
        - location.country → drzava
        - load1 → total_weight
        - load2 → total_volume
        - tags → [regija, vozilo_tip, vrsta_isporuke]
        - notes → internal order info
        
        Args:
            nalog_uid: Nalog prodaje UID
            db: Database session
            
        Returns:
            Dict s OptimoRoute payload ili None
        """
        # Get nalog
        nalog = db.query(NaloziHeader).filter(
            NaloziHeader.nalog_prodaje_uid == nalog_uid
        ).first()
        
        if not nalog:
            logger.error(f"Nalog {nalog_uid} not found")
            return None
        
        # Get partner
        partner = None
        if nalog.partner_uid:
            partner = db.query(Partneri).filter(
                Partneri.partner_uid == nalog.partner_uid
            ).first()
        
        # Get region
        regija = None
        if nalog.regija_id:
            regija = db.query(Regije).filter(
                Regije.regija_id == nalog.regija_id
            ).first()
        
        # Build location name
        location_name = None
        if partner:
            if partner.naziv:
                location_name = partner.naziv
            elif partner.ime and partner.prezime:
                location_name = f"{partner.ime} {partner.prezime}"
            elif partner.ime:
                location_name = partner.ime
        
        # Build tags
        tags = []
        if regija:
            tags.append(regija.naziv_regije)
        if nalog.vozilo_tip:
            tags.append(nalog.vozilo_tip)
        if nalog.vrsta_isporuke:
            tags.append(nalog.vrsta_isporuke)
        
        # Build notes
        notes_parts = []
        if nalog.status:
            notes_parts.append(f"Status: {nalog.status}")
        if nalog.za_naplatu:
            notes_parts.append(f"Za naplatu: {nalog.za_naplatu} EUR")
        if nalog.broj:
            notes_parts.append(f"Broj: {nalog.broj}")
        notes = ", ".join(notes_parts) if notes_parts else None
        
        # Build payload
        payload = {
            "id": nalog.nalog_prodaje_uid,
            "date": nalog.raspored.isoformat() if nalog.raspored else None,
            "location": {
                "name": location_name,
                "address": partner.adresa if partner else None,
                "postcode": partner.postanski_broj if partner else None,
                "city": partner.naziv_mjesta if partner else None,
                "country": partner.drzava if partner else None
            },
            "load1": float(nalog.total_weight) if nalog.total_weight else None,
            "load2": float(nalog.total_volume) if nalog.total_volume else None,
            "tags": tags if tags else None,
            "notes": notes
        }
        
        # Remove None values from location
        payload["location"] = {k: v for k, v in payload["location"].items() if v is not None}
        
        return payload
    
    @staticmethod
    def save_payload(
        nalog_uid: str,
        db: Session
    ) -> bool:
        """
        Generira i sprema OptimoRoute payload u OptimoOrders tablicu.
        
        Args:
            nalog_uid: Nalog prodaje UID
            db: Database session
            
        Returns:
            True ako je uspješno spremljeno
        """
        payload = OptimoMapper.generate_payload(nalog_uid, db)
        
        if not payload:
            return False
        
        # Get nalog for regija_id and vozilo_tip
        nalog = db.query(NaloziHeader).filter(
            NaloziHeader.nalog_prodaje_uid == nalog_uid
        ).first()
        
        if not nalog:
            return False
        
        # Convert payload to JSON string
        payload_json = json.dumps(payload, ensure_ascii=False, indent=2)
        
        # Check if OptimoOrder already exists
        optimo_order = db.query(OptimoOrders).filter(
            OptimoOrders.nalog_prodaje_uid == nalog_uid
        ).first()
        
        if optimo_order:
            # Update existing
            optimo_order.payload_json = payload_json
            optimo_order.regija_id = nalog.regija_id
            optimo_order.vozilo_tip = nalog.vozilo_tip
        else:
            # Create new
            optimo_order = OptimoOrders(
                nalog_prodaje_uid=nalog_uid,
                payload_json=payload_json,
                regija_id=nalog.regija_id,
                vozilo_tip=nalog.vozilo_tip
            )
            db.add(optimo_order)
        
        try:
            db.commit()
            logger.info(f"Saved OptimoRoute payload for nalog {nalog_uid}")
            return True
        except Exception as e:
            logger.error(f"Error saving OptimoRoute payload for nalog {nalog_uid}: {e}")
            db.rollback()
            return False
    
    @staticmethod
    def get_payload(
        nalog_uid: str,
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """
        Dohvaća spremljeni OptimoRoute payload za nalog.
        
        Args:
            nalog_uid: Nalog prodaje UID
            db: Database session
            
        Returns:
            Dict s payload ili None
        """
        optimo_order = db.query(OptimoOrders).filter(
            OptimoOrders.nalog_prodaje_uid == nalog_uid
        ).first()
        
        if not optimo_order or not optimo_order.payload_json:
            return None
        
        try:
            return json.loads(optimo_order.payload_json)
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing payload JSON for nalog {nalog_uid}: {e}")
            return None
