"""ERP communication log model."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from app.db.base import Base


class ErpLog(Base):
    __tablename__ = "erp_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    document_type = Column(String(10), nullable=False)
    document_uid = Column(String(50), nullable=True)
    action = Column(String(30), nullable=False)
    request_payload = Column(Text, nullable=True)
    response_payload = Column(Text, nullable=True)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
