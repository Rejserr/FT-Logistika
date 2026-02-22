import logging
import time
import traceback
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import settings
from app.core.logging_config import setup_logging, correlation_id_var

# Setup structured JSON logging with file rotation
setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="FT-Logistika API")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    cid = correlation_id_var.get(None) or "unknown"
    tb = traceback.format_exc()
    logger.critical(
        "UNHANDLED EXCEPTION on %s %s [cid=%s]: %s\n%s",
        request.method, request.url.path, cid, exc, tb,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Došlo je do interne greške. Kontaktirajte administratora.",
            "correlation_id": cid,
        },
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Generate and set correlation ID for this request
    cid = str(uuid.uuid4())[:8]
    correlation_id_var.set(cid)

    start = time.perf_counter()
    logger.info("%s %s [cid=%s]", request.method, request.url.path, cid)
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000)

    if response.status_code >= 400:
        logger.warning(
            "%s %s -> %s (%dms) [cid=%s]",
            request.method, request.url.path, response.status_code, duration_ms, cid,
        )
    response.headers["X-Correlation-ID"] = cid
    return response


origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api")
app.include_router(api_router, prefix="/api/v1")  # versioning priprema


def _add_column_if_missing(engine, table: str, column: str, col_type: str, default: str | None = None):
    """Safely add a column to an existing table if it doesn't exist."""
    from sqlalchemy import text, inspect as sa_inspect
    insp = sa_inspect(engine)
    existing_cols = {c["name"].lower() for c in insp.get_columns(table)}
    if column.lower() not in existing_cols:
        default_clause = f" DEFAULT {default}" if default else ""
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE [{table}] ADD [{column}] {col_type}{default_clause}"))
            conn.commit()
        logger.info("Dodana kolona %s.%s (%s)", table, column, col_type)


@app.on_event("startup")
def _ensure_tables():
    """Kreiraj nove tablice ako ne postoje i popuni defaultne podatke."""
    from app.db.base import Base
    from app.db.session import engine, SessionLocal
    import app.models  # noqa: F401
    from app.models.config_models import SyncStatus
    from app.models.user_models import User, Role, Permission, RolePermission
    from app.core.security import hash_password

    # --- Migriraj kolone na postojećim tablicama PRIJE create_all ---
    from sqlalchemy import inspect as sa_inspect
    insp = sa_inspect(engine)
    existing_tables = {t.lower() for t in insp.get_table_names()}

    if "roles" in existing_tables:
        _add_column_if_missing(engine, "roles", "description", "NVARCHAR(255)", "NULL")
        _add_column_if_missing(engine, "roles", "is_system", "BIT", "0")
        _add_column_if_missing(engine, "roles", "created_at", "DATETIME", "GETUTCDATE()")

    if "users" in existing_tables:
        _add_column_if_missing(engine, "users", "role_id", "INT", "NULL")
        _add_column_if_missing(engine, "users", "warehouse_id", "INT", "NULL")
        _add_column_if_missing(engine, "users", "vozac_id", "INT", "NULL")
        _add_column_if_missing(engine, "users", "force_password_change", "BIT", "0")
        _add_column_if_missing(engine, "users", "locked", "BIT", "0")
        _add_column_if_missing(engine, "users", "failed_login_attempts", "INT", "0")
        _add_column_if_missing(engine, "users", "last_login", "DATETIME", "NULL")
        _add_column_if_missing(engine, "users", "last_login_ip", "NVARCHAR(45)", "NULL")

    if "audit_log" in existing_tables:
        _add_column_if_missing(engine, "audit_log", "old_values", "NVARCHAR(MAX)", "NULL")
        _add_column_if_missing(engine, "audit_log", "new_values", "NVARCHAR(MAX)", "NULL")
        _add_column_if_missing(engine, "audit_log", "ip_address", "NVARCHAR(45)", "NULL")
        _add_column_if_missing(engine, "audit_log", "user_agent", "NVARCHAR(500)", "NULL")
        _add_column_if_missing(engine, "audit_log", "warehouse_id", "INT", "NULL")
        _add_column_if_missing(engine, "audit_log", "correlation_id", "NVARCHAR(36)", "NULL")

    if "vozila" in existing_tables:
        _add_column_if_missing(engine, "vozila", "registracija", "NVARCHAR(20)", "NULL")
        _add_column_if_missing(engine, "vozila", "warehouse_id", "INT", "NULL")

    if "vozaci" in existing_tables:
        _add_column_if_missing(engine, "vozaci", "warehouse_id", "INT", "NULL")

    if "rute" in existing_tables:
        _add_column_if_missing(engine, "rute", "warehouse_id", "INT", "NULL")
        _add_column_if_missing(engine, "rute", "driver_user_id", "INT", "NULL")
        _add_column_if_missing(engine, "rute", "driver_name", "NVARCHAR(200)", "NULL")

    if "driver_sessions" in existing_tables:
        _add_column_if_missing(engine, "driver_sessions", "on_duty", "BIT", "0")

    if "delivery_proofs" in existing_tables:
        _add_column_if_missing(engine, "delivery_proofs", "nalog_prodaje_uid", "NVARCHAR(50)", "NULL")
        _add_column_if_missing(engine, "delivery_proofs", "photo_paths", "NVARCHAR(MAX)", "NULL")
        _add_column_if_missing(engine, "delivery_proofs", "luceed_sent_at", "DATETIME", "NULL")

    if "skladista" in existing_tables:
        _add_column_if_missing(engine, "skladista", "code", "NVARCHAR(10)", "NULL")
        _add_column_if_missing(engine, "skladista", "is_central", "BIT", "0")
        _add_column_if_missing(engine, "skladista", "radno_vrijeme_od", "NVARCHAR(5)", "NULL")
        _add_column_if_missing(engine, "skladista", "radno_vrijeme_do", "NVARCHAR(5)", "NULL")
        _add_column_if_missing(engine, "skladista", "kontakt_telefon", "NVARCHAR(50)", "NULL")
        _add_column_if_missing(engine, "skladista", "kontakt_email", "NVARCHAR(100)", "NULL")
        _add_column_if_missing(engine, "skladista", "max_vozila", "INT", "NULL")

    # Kreiraj nove tablice (permissions, role_permissions, refresh_tokens, driver_sessions, delivery_proofs, itd.)
    Base.metadata.create_all(bind=engine, checkfirst=True)

    # Postavi warehouse_id za postojeća vozila/rute na centralno skladište (code='100')
    with SessionLocal() as db:
        from sqlalchemy import select, update
        from app.models.erp_models import Skladiste as _Skl
        central = db.execute(select(_Skl).where(_Skl.code == "100")).scalar_one_or_none()
        if central:
            from app.models.vehicle_models import Vozilo as _Voz, Vozac as _Vzc
            from app.models.routing_models import Ruta as _Rut
            db.execute(
                update(_Voz).where(_Voz.warehouse_id.is_(None)).values(warehouse_id=central.id)
            )
            db.execute(
                update(_Vzc).where(_Vzc.warehouse_id.is_(None)).values(warehouse_id=central.id)
            )
            db.execute(
                update(_Rut).where(_Rut.warehouse_id.is_(None)).values(warehouse_id=central.id)
            )
            db.commit()

    with SessionLocal() as db:
        # --- Sync statusi ---
        count = db.query(SyncStatus).count()
        if count == 0:
            defaults = [
                SyncStatus(status_id="08", naziv="Odobreno"),
                SyncStatus(status_id="101", naziv="U procesu pakiranja"),
                SyncStatus(status_id="102", naziv="Pakirano"),
                SyncStatus(status_id="103", naziv="Spremno za utovar"),
            ]
            db.add_all(defaults)
            db.commit()
            logger.info("Dodano %d defaultnih sync statusa", len(defaults))

        # --- Roles ---
        role_defs = [
            ("Admin", "Puni pristup svim modulima i skladištima", True),
            ("Disponent", "CRUD rute/nalozi za svoje skladište", True),
            ("Vozac", "Pregled svojih ruta, update statusa dostave", True),
            ("Viewer", "Read-only pristup svom skladištu", True),
        ]
        for name, desc, is_sys in role_defs:
            existing = db.query(Role).filter(Role.name == name).first()
            if not existing:
                db.add(Role(name=name, description=desc, is_system=is_sys))
            elif existing.is_system is None or existing.description != desc:
                existing.is_system = is_sys
                existing.description = desc
        db.commit()

        # --- Permissions ---
        perm_defs = [
            ("orders.view", "Pregled naloga", "orders"),
            ("orders.create", "Kreiranje naloga", "orders"),
            ("orders.edit", "Uređivanje naloga", "orders"),
            ("orders.delete", "Brisanje naloga", "orders"),
            ("routes.view", "Pregled ruta", "routes"),
            ("routes.create", "Kreiranje ruta", "routes"),
            ("routes.edit", "Uređivanje ruta", "routes"),
            ("routes.delete", "Brisanje ruta", "routes"),
            ("routes.manage_stops", "Upravljanje stopovima rute", "routes"),
            ("vehicles.view", "Pregled vozila", "vehicles"),
            ("vehicles.create", "Kreiranje vozila", "vehicles"),
            ("vehicles.edit", "Uređivanje vozila", "vehicles"),
            ("vehicles.delete", "Brisanje vozila", "vehicles"),
            ("warehouses.view", "Pregled skladišta", "warehouses"),
            ("warehouses.create", "Kreiranje skladišta", "warehouses"),
            ("warehouses.edit", "Uređivanje skladišta", "warehouses"),
            ("warehouses.delete", "Brisanje skladišta", "warehouses"),
            ("users.view", "Pregled korisnika", "users"),
            ("users.create", "Kreiranje korisnika", "users"),
            ("users.edit", "Uređivanje korisnika", "users"),
            ("users.delete", "Brisanje korisnika", "users"),
            ("users.manage_roles", "Upravljanje rolama", "users"),
            ("roles.view", "Pregled rola", "roles"),
            ("roles.create", "Kreiranje rola", "roles"),
            ("roles.edit", "Uređivanje rola", "roles"),
            ("roles.delete", "Brisanje rola", "roles"),
            ("settings.view", "Pregled postavki", "settings"),
            ("settings.manage", "Upravljanje postavkama", "settings"),
            ("sync.view", "Pregled sinkronizacije", "sync"),
            ("sync.execute", "Pokretanje sinkronizacije", "sync"),
            ("reports.view", "Pregled izvještaja", "reports"),
            ("reports.export", "Export izvještaja", "reports"),
            ("audit.view", "Pregled audit loga", "audit"),
            ("geocoding.view", "Pregled geocodinga", "geocoding"),
            ("geocoding.edit", "Uređivanje geocodinga", "geocoding"),
        ]
        for name, desc, module in perm_defs:
            existing = db.query(Permission).filter(Permission.name == name).first()
            if not existing:
                db.add(Permission(name=name, description=desc, module=module))
        db.commit()

        # --- Role-Permission mapping ---
        all_perms = {p.name: p.id for p in db.query(Permission).all()}
        role_perm_map = {
            "Admin": list(all_perms.keys()),
            "Disponent": [
                "orders.view", "orders.create", "orders.edit",
                "routes.view", "routes.create", "routes.edit", "routes.delete", "routes.manage_stops",
                "vehicles.view",
                "warehouses.view",
                "settings.view",
                "sync.view", "sync.execute",
                "reports.view", "reports.export",
                "geocoding.view", "geocoding.edit",
            ],
            "Vozac": [
                "orders.view",
                "routes.view", "routes.manage_stops",
                "vehicles.view",
            ],
            "Viewer": [
                "orders.view",
                "routes.view",
                "vehicles.view",
                "warehouses.view",
                "reports.view",
            ],
        }
        for role_name, perm_names in role_perm_map.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                continue
            existing_rp = {
                rp.permission_id for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all()
            }
            for pn in perm_names:
                pid = all_perms.get(pn)
                if pid and pid not in existing_rp:
                    db.add(RolePermission(role_id=role.id, permission_id=pid))
        db.commit()

        # --- Admin user ---
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_role = db.query(Role).filter(Role.name == "Admin").first()
            admin_user = User(
                username="admin",
                password_hash=hash_password("admin123"),
                ime="Administrator",
                prezime="",
                email="admin@ftlogistika.hr",
                aktivan=True,
                role_id=admin_role.id if admin_role else None,
                force_password_change=True,
            )
            db.add(admin_user)
            db.commit()
            logger.info("Admin user kreiran (admin / admin123) — OBAVEZNO promijeni lozinku!")
