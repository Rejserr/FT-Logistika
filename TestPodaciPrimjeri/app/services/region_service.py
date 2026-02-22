"""
Region service - mapira poštanske brojeve na regije
"""
from sqlalchemy.orm import Session
from app.models.regional_models import Regije, PostanskiBrojevi
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class RegionService:
    """Service za mapiranje partnera na regije"""

    @staticmethod
    def normalize_postal_code(postanski_broj: str) -> Optional[str]:
        """
        Normalizira poštanski broj: uklanja razmake i sve nedigitalne znakove.
        """
        if not postanski_broj:
            return None
        digits_only = "".join(ch for ch in postanski_broj if ch.isdigit())
        if not digits_only:
            return None
        return digits_only[:5]
    
    @staticmethod
    def get_region_by_postal_code(
        postanski_broj: str,
        db: Session
    ) -> Optional[Regije]:
        """
        Pronalazi regiju na temelju poštanskog broja.
        
        Args:
            postanski_broj: Poštanski broj partnera
            db: Database session
            
        Returns:
            Regije objekt ili None ako nije pronađeno
        """
        clean_postal = RegionService.normalize_postal_code(postanski_broj)
        if not clean_postal:
            return None
        
        # Find postal code mapping
        postal_mapping = db.query(PostanskiBrojevi).filter(
            PostanskiBrojevi.postanski_broj == clean_postal
        ).first()
        
        if not postal_mapping or not postal_mapping.regija_id:
            logger.debug(f"No region mapping found for postal code '{postanski_broj}'")
            return None
        
        # Get region
        regija = db.query(Regije).filter(
            Regije.regija_id == postal_mapping.regija_id
        ).first()
        
        return regija
    
    @staticmethod
    def assign_region_to_nalog(
        nalog_uid: str,
        partner_postanski_broj: str,
        db: Session
    ) -> Optional[int]:
        """
        Dodjeljuje regiju nalogu na temelju poštanskog broja partnera.
        
        Args:
            nalog_uid: Nalog prodaje UID
            partner_postanski_broj: Poštanski broj partnera
            db: Database session
            
        Returns:
            regija_id ako je uspješno dodijeljeno, None inače
        """
        regija = RegionService.get_region_by_postal_code(partner_postanski_broj, db)
        
        if not regija:
            logger.debug(f"No region found for postal code '{partner_postanski_broj}', nalog {nalog_uid}")
            return None
        
        # Update nalog
        from app.models.erp_models import NaloziHeader
        nalog = db.query(NaloziHeader).filter(
            NaloziHeader.nalog_prodaje_uid == nalog_uid
        ).first()
        
        if not nalog:
            logger.error(f"Nalog {nalog_uid} not found")
            return None
        
        nalog.regija_id = regija.regija_id
        
        try:
            db.commit()
            logger.debug(f"Assigned region {regija.regija_id} ({regija.naziv_regije}) to nalog {nalog_uid}")
            return regija.regija_id
        except Exception as e:
            logger.error(f"Error assigning region to nalog {nalog_uid}: {e}")
            db.rollback()
            return None
    
    @staticmethod
    def create_region(naziv_regije: str, opis: str = None, db: Session = None) -> Optional[Regije]:
        """
        Kreira novu regiju.
        
        Args:
            naziv_regije: Naziv regije
            opis: Opis regije (opcionalno)
            db: Database session
            
        Returns:
            Kreirana Regije objekt
        """
        # Check if exists
        existing = db.query(Regije).filter(
            Regije.naziv_regije == naziv_regije
        ).first()
        
        if existing:
            return existing
        
        # Create new
        regija = Regije(
            naziv_regije=naziv_regije,
            opis=opis
        )
        
        try:
            db.add(regija)
            db.commit()
            db.refresh(regija)
            logger.info(f"Created region: {regija.regija_id} - {naziv_regije}")
            return regija
        except Exception as e:
            logger.error(f"Error creating region '{naziv_regije}': {e}")
            db.rollback()
            return None
