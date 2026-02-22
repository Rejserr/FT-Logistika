"""Models for driver mobile app — sessions, proof of delivery, GPS tracking."""

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, ForeignKey, Numeric, Text, func,
)
from app.db.base import Base


class DriverSession(Base):
    """Tracks driver login sessions — links a user (driver) to a vehicle for a given day."""
    __tablename__ = "driver_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vozilo_id = Column(Integer, ForeignKey("vozila.id"), nullable=True)
    registration_plate = Column(String(20), nullable=True)
    on_duty = Column(Boolean, nullable=False, server_default="0")
    started_at = Column(DateTime, server_default=func.getutcdate())
    ended_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="1")


class DeliveryProof(Base):
    """Proof of delivery — signature, photo, GPS, recipient info."""
    __tablename__ = "delivery_proofs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stop_id = Column(Integer, ForeignKey("rute_stops.id"), nullable=False)
    driver_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    nalog_prodaje_uid = Column(String(50), nullable=True)
    signature_path = Column(String(500), nullable=True)
    photo_path = Column(String(500), nullable=True)
    photo_paths = Column(Text, nullable=True)  # JSON array of photo paths
    recipient_name = Column(String(200), nullable=True)
    comment = Column(Text, nullable=True)
    gps_lat = Column(Numeric(18, 8), nullable=True)
    gps_lng = Column(Numeric(18, 8), nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
    luceed_sent_at = Column(DateTime, nullable=True)


class DriverLocation(Base):
    """GPS location tracking — stores periodic location updates from driver app."""
    __tablename__ = "driver_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("driver_sessions.id"), nullable=True)
    lat = Column(Numeric(18, 8), nullable=False)
    lng = Column(Numeric(18, 8), nullable=False)
    accuracy = Column(Numeric(10, 2), nullable=True)
    speed = Column(Numeric(10, 2), nullable=True)
    heading = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())
