"""
Delivery filter service - provjerava dozvoljene vrste isporuke
"""
from sqlalchemy.orm import Session
from app.models.config_models import AllowedDeliveryTypes
import logging

logger = logging.getLogger(__name__)


class DeliveryFilterService:
    """Service za filtriranje naloga po dozvoljenim vrstama isporuke"""
    
    @staticmethod
    async def is_delivery_type_allowed(vrsta_isporuke: str, db: Session) -> bool:
        """
        Provjerava je li vrsta isporuke dozvoljena za spremanje u bazu.
        
        Args:
            vrsta_isporuke: Vrsta isporuke iz ERP-a (npr. 'VDK', 'B2BD')
            db: Database session
            
        Returns:
            True ako je dozvoljeno, False inače
        """
        if not vrsta_isporuke:
            logger.warning("vrsta_isporuke is empty or None")
            return False
        
        allowed = db.query(AllowedDeliveryTypes).filter(
            AllowedDeliveryTypes.vrsta_isporuke == vrsta_isporuke,
            AllowedDeliveryTypes.aktivan == True
        ).first()
        
        if allowed:
            return True
        else:
            logger.info(f"Delivery type '{vrsta_isporuke}' is not allowed or inactive")
            return False
    
    @staticmethod
    async def filter_allowed_nalozi(
        nalozi: list, 
        db: Session
    ) -> list:
        """
        Filtrira listu naloga i vraća samo one s dozvoljenim vrstama isporuke.
        
        Args:
            nalozi: Lista naloga iz ERP-a
            db: Database session
            
        Returns:
            Filtrirana lista naloga
        """
        allowed_nalozi = []
        
        for nalog in nalozi:
            vrsta_isporuke = nalog.get("vrsta_isporuke")
            
            if await DeliveryFilterService.is_delivery_type_allowed(vrsta_isporuke, db):
                allowed_nalozi.append(nalog)
            else:
                logger.debug(
                    f"Skipping nalog {nalog.get('nalog_prodaje_uid')} "
                    f"with delivery type '{vrsta_isporuke}'"
                )
        
        logger.info(
            f"Filtered {len(nalozi)} nalozi: {len(allowed_nalozi)} allowed, "
            f"{len(nalozi) - len(allowed_nalozi)} skipped"
        )
        
        return allowed_nalozi
    
    @staticmethod
    def get_all_allowed_types(db: Session) -> list:
        """
        Vraća listu svih aktivnih dozvoljenih vrsta isporuke.
        
        Args:
            db: Database session
            
        Returns:
            Lista vrsta isporuke
        """
        allowed = db.query(AllowedDeliveryTypes).filter(
            AllowedDeliveryTypes.aktivan == True
        ).all()
        
        return [a.vrsta_isporuke for a in allowed]
