"""
Logistics service - određuje tip vozila na temelju pravila
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.logistics_models import LogistickaPravila
from app.models.erp_models import NaloziHeader
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)


class LogisticsService:
    """Service za evaluaciju logističkih pravila i određivanje tipa vozila"""
    
    @staticmethod
    def evaluate_rules(
        regija_id: Optional[int],
        grupe_artikala: List[str],
        total_weight: float,
        total_volume: float,
        db: Session
    ) -> Optional[LogistickaPravila]:
        """
        Evaluira logistička pravila i vraća najbolje odgovarajuće pravilo.
        
        Matching kriteriji:
        1. regija_id (ako je specificiran)
        2. grupa_artikla_uid (ako je specificiran)
        3. masa (min_masa <= total_weight <= max_masa)
        4. volumen (min_volumen <= total_volume <= max_volumen)
        
        Sortira po prioritet DESC (viši prioritet = bolje).
        
        Args:
            regija_id: ID regije naloga
            grupe_artikala: Lista UID-ova grupa artikala u nalogu
            total_weight: Ukupna masa naloga
            total_volume: Ukupni volumen naloga
            db: Database session
            
        Returns:
            LogistickaPravila objekt ili None ako nema matcha
        """
        # Base query - samo aktivna pravila
        query = db.query(LogistickaPravila).filter(
            LogistickaPravila.aktivan == True
        )
        
        # Build matching conditions
        conditions = []
        
        # Regija match (ako je specificiran u pravilu)
        if regija_id:
            conditions.append(
                or_(
                    LogistickaPravila.regija_id == regija_id,
                    LogistickaPravila.regija_id.is_(None)  # Pravilo za sve regije
                )
            )
        else:
            # Ako nalog nema regiju, uzmi samo pravila bez regije
            conditions.append(LogistickaPravila.regija_id.is_(None))
        
        # Grupa artikla match (ako je specificiran u pravilu)
        if grupe_artikala:
            conditions.append(
                or_(
                    LogistickaPravila.grupa_artikla_uid.in_(grupe_artikala),
                    LogistickaPravila.grupa_artikla_uid.is_(None)  # Pravilo za sve grupe
                )
            )
        else:
            # Ako nema grupa, uzmi samo pravila bez grupe
            conditions.append(LogistickaPravila.grupa_artikla_uid.is_(None))
        
        # Masa match
        masa_conditions = []
        if total_weight is not None:
            masa_conditions.append(
                or_(
                    and_(
                        LogistickaPravila.min_masa.is_(None),
                        LogistickaPravila.max_masa.is_(None)
                    ),  # Nema ograničenja
                    and_(
                        or_(LogistickaPravila.min_masa.is_(None), LogistickaPravila.min_masa <= total_weight),
                        or_(LogistickaPravila.max_masa.is_(None), LogistickaPravila.max_masa >= total_weight)
                    )
                )
            )
        else:
            # Ako nema mase, uzmi samo pravila bez ograničenja mase
            masa_conditions.append(
                and_(
                    LogistickaPravila.min_masa.is_(None),
                    LogistickaPravila.max_masa.is_(None)
                )
            )
        
        # Volumen match
        volumen_conditions = []
        if total_volume is not None:
            volumen_conditions.append(
                or_(
                    and_(
                        LogistickaPravila.min_volumen.is_(None),
                        LogistickaPravila.max_volumen.is_(None)
                    ),  # Nema ograničenja
                    and_(
                        or_(LogistickaPravila.min_volumen.is_(None), LogistickaPravila.min_volumen <= total_volume),
                        or_(LogistickaPravila.max_volumen.is_(None), LogistickaPravila.max_volumen >= total_volume)
                    )
                )
            )
        else:
            # Ako nema volumena, uzmi samo pravila bez ograničenja volumena
            volumen_conditions.append(
                and_(
                    LogistickaPravila.min_volumen.is_(None),
                    LogistickaPravila.max_volumen.is_(None)
                )
            )
        
        # Apply all conditions
        query = query.filter(
            and_(*conditions),
            or_(*masa_conditions),
            or_(*volumen_conditions)
        )
        
        # Sort by prioritet DESC (higher priority = better match)
        query = query.order_by(LogistickaPravila.prioritet.desc())
        
        # Get first matching rule
        rule = query.first()
        
        if rule:
            logger.debug(
                f"Matched rule {rule.pravilo_id} ({rule.naziv_pravila}) "
                f"for regija={regija_id}, weight={total_weight}, volume={total_volume}"
            )
        else:
            logger.debug(
                f"No matching rule for regija={regija_id}, weight={total_weight}, volume={total_volume}"
            )
        
        return rule
    
    @staticmethod
    def determine_vehicle_type(
        nalog_uid: str,
        db: Session
    ) -> Optional[str]:
        """
        Određuje tip vozila za nalog na temelju logističkih pravila.
        
        Args:
            nalog_uid: Nalog prodaje UID
            db: Database session
            
        Returns:
            'KAMION' ili 'KOMBI' ili None
        """
        # Get nalog
        nalog = db.query(NaloziHeader).filter(
            NaloziHeader.nalog_prodaje_uid == nalog_uid
        ).first()
        
        if not nalog:
            logger.error(f"Nalog {nalog_uid} not found")
            return None
        
        # Get grupe artikala
        from app.services.aggregation_service import AggregationService
        totals = AggregationService.calculate_order_totals(nalog_uid, db)
        grupe_artikala = totals.get("grupe_artikala", [])
        
        # Evaluate rules
        rule = LogisticsService.evaluate_rules(
            regija_id=nalog.regija_id,
            grupe_artikala=grupe_artikala,
            total_weight=float(nalog.total_weight or 0),
            total_volume=float(nalog.total_volume or 0),
            db=db
        )
        
        if rule:
            # Update nalog with vehicle type
            nalog.vozilo_tip = rule.vozilo_tip
            try:
                db.commit()
                logger.info(f"Assigned vehicle type '{rule.vozilo_tip}' to nalog {nalog_uid}")
                return rule.vozilo_tip
            except Exception as e:
                logger.error(f"Error updating vehicle type for nalog {nalog_uid}: {e}")
                db.rollback()
                return None
        
        logger.warning(f"No matching rule found for nalog {nalog_uid}")
        return None
