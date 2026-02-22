"""
SQLAlchemy model za Mantis WMS SSCC podatke.

Tablica mantis_sscc služi kao lokalni cache podataka iz
Mantis WMS view-a v_CST_OrderProgress.
"""
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Numeric,
    Text,
    func,
)

from app.db.base import Base


class MantisSSCC(Base):
    """Cache redak iz Mantis WMS v_CST_OrderProgress viewa."""
    __tablename__ = "mantis_sscc"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_code = Column(String(50), nullable=False, index=True)          # WMS OrderCode "7360-11"
    nalog_prodaje_uid = Column(String(50), nullable=True, index=True)    # naš nalog FK
    order_shipment_code = Column(String(50), nullable=True)
    product_id = Column(Integer, nullable=True)
    product = Column(String(500), nullable=True)                         # "K00986 - Pločica..."
    quantity = Column(Numeric(18, 6), nullable=True)
    item_status_id = Column(Integer, nullable=True)
    item_status_code = Column(String(20), nullable=True)
    item_status_code2 = Column(String(20), nullable=True)
    item_status = Column(String(100), nullable=True)                     # "30 - For picking"
    zone = Column(String(50), nullable=True)
    zone_id = Column(Integer, nullable=True)
    location = Column(String(100), nullable=True)
    sscc = Column(String(50), nullable=True, index=True)                 # SSCC barcode
    psscc = Column(String(50), nullable=True)                            # Parent SSCC
    order_shipment_status_id = Column(Integer, nullable=True)
    order_shipment_status_code = Column(String(20), nullable=True)
    order_shipment_status = Column(String(100), nullable=True)
    customer = Column(String(255), nullable=True)
    receiver = Column(String(255), nullable=True)
    memo = Column(Text, nullable=True)
    assigned_user = Column(String(100), nullable=True)
    agency = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    synced_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())
