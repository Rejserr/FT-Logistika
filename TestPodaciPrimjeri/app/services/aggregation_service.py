"""
Aggregation service - računa total_weight, total_volume, grupe artikala
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.erp_models import NaloziHeader, NaloziDetails, Artikli
from typing import Dict, List, Set
import logging

logger = logging.getLogger(__name__)


class AggregationService:
    """Service za agregaciju podataka naloga"""
    
    @staticmethod
    def calculate_order_totals(
        nalog_uid: str,
        db: Session
    ) -> Dict[str, any]:
        """
        Računa total_weight i total_volume za nalog.
        
        Formula:
        - total_weight = SUM(stavka.kolicina * artikl.masa)
        - total_volume = SUM(stavka.kolicina * artikl.volumen)
        
        Args:
            nalog_uid: Nalog prodaje UID
            db: Database session
            
        Returns:
            Dict s total_weight, total_volume, grupe_artikala
        """
        # Get all stavke for this nalog
        stavke = db.query(NaloziDetails).filter(
            NaloziDetails.nalog_prodaje_uid == nalog_uid
        ).all()
        
        total_weight = 0.0
        total_volume = 0.0
        grupe_artikala: Set[str] = set()
        
        for stavka in stavke:
            if not stavka.artikl_uid:
                continue
            
            # Get artikl
            artikl = db.query(Artikli).filter(
                Artikli.artikl_uid == stavka.artikl_uid
            ).first()
            
            if not artikl:
                logger.warning(f"Artikl {stavka.artikl_uid} not found for stavka {stavka.stavka_uid}")
                continue
            
            # Calculate weight and volume
            kolicina = float(stavka.kolicina or 0)
            masa = float(artikl.masa or 0)
            volumen = float(artikl.volumen or 0)
            
            total_weight += kolicina * masa
            total_volume += kolicina * volumen
            
            # Collect grupa_artikla_uid
            if artikl.grupa_artikla_uid:
                grupe_artikala.add(artikl.grupa_artikla_uid)
        
        return {
            "total_weight": total_weight,
            "total_volume": total_volume,
            "grupe_artikala": list(grupe_artikala)
        }
    
    @staticmethod
    def update_nalog_totals(
        nalog_uid: str,
        db: Session
    ) -> bool:
        """
        Ažurira total_weight i total_volume u NaloziHeader.
        
        Args:
            nalog_uid: Nalog prodaje UID
            db: Database session
            
        Returns:
            True ako je uspješno ažurirano
        """
        totals = AggregationService.calculate_order_totals(nalog_uid, db)
        
        nalog = db.query(NaloziHeader).filter(
            NaloziHeader.nalog_prodaje_uid == nalog_uid
        ).first()
        
        if not nalog:
            logger.error(f"Nalog {nalog_uid} not found")
            return False
        
        nalog.total_weight = totals["total_weight"]
        nalog.total_volume = totals["total_volume"]
        
        try:
            db.commit()
            logger.debug(f"Updated totals for nalog {nalog_uid}: weight={totals['total_weight']}, volume={totals['total_volume']}")
            return True
        except Exception as e:
            logger.error(f"Error updating totals for nalog {nalog_uid}: {e}")
            db.rollback()
            return False
