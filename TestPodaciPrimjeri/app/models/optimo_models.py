"""
OptimoRoute models - OptimoOrders
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class OptimoOrders(Base):
    """Generirani OptimoRoute order payloadi"""
    __tablename__ = "OptimoOrders"
    
    nalog_prodaje_uid = Column(String(50), ForeignKey("NaloziHeader.nalog_prodaje_uid"), primary_key=True)
    payload_json = Column(Text, nullable=True)
    regija_id = Column(Integer, ForeignKey("Regije.regija_id"), nullable=True)
    vozilo_tip = Column(String(20), nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_to_optimo = Column(Boolean, default=False, nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    nalog = relationship("NaloziHeader", back_populates="optimo_order")
    regija = relationship("Regije")
    
    __table_args__ = (
        Index("IX_OptimoOrders_Regija", "regija_id"),
        Index("IX_OptimoOrders_Sent", "sent_to_optimo"),
    )
    
    def __repr__(self):
        return f"<OptimoOrders(nalog_prodaje_uid='{self.nalog_prodaje_uid}', sent={self.sent_to_optimo})>"
