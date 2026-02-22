from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, ForeignKey, Text, func, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    ime = Column(String(100), nullable=True)
    prezime = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    aktivan = Column(Boolean, nullable=False, server_default="1")

    # Auth & security
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    warehouse_id = Column(Integer, ForeignKey("skladista.id"), nullable=True)
    vozac_id = Column(Integer, ForeignKey("vozaci.id"), nullable=True)
    force_password_change = Column(Boolean, nullable=False, server_default="0")
    locked = Column(Boolean, nullable=False, server_default="0")
    failed_login_attempts = Column(Integer, nullable=False, server_default="0")
    last_login = Column(DateTime, nullable=True)
    last_login_ip = Column(String(45), nullable=True)

    created_at = Column(DateTime, server_default=func.getutcdate())
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())

    # Relationships
    role = relationship("Role", lazy="joined")

    @property
    def full_name(self) -> str:
        parts = [self.ime or "", self.prezime or ""]
        return " ".join(p for p in parts if p).strip() or self.username


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_system = Column(Boolean, nullable=False, server_default="0")
    created_at = Column(DateTime, server_default=func.getutcdate())

    permissions = relationship("Permission", secondary="role_permissions", lazy="joined")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    module = Column(String(50), nullable=False)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)


class UserRole(Base):
    """Legacy junction table — kept for backward compatibility. New code uses User.role_id."""
    __tablename__ = "user_roles"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, nullable=False, server_default="0")
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=True)
    entity_id = Column(String(100), nullable=True)
    data = Column(Text, nullable=True)
    old_values = Column(Text, nullable=True)
    new_values = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    warehouse_id = Column(Integer, nullable=True)
    correlation_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.getutcdate())


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    pref_key = Column(String(200), nullable=False)
    pref_value = Column(Text, nullable=False)
    updated_at = Column(DateTime, server_default=func.getutcdate(), onupdate=func.getutcdate())

    __table_args__ = (
        UniqueConstraint("user_id", "pref_key", name="uq_user_pref_key"),
    )
