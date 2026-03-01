from fastapi import APIRouter, Depends

from app.api.auth import router as auth_router
from app.api.config import router as config_router
from app.api.health import router as health_router
from app.api.orders import router as orders_router
from app.api.items import router as items_router
from app.api.regions import router as regions_router
from app.api.routing import router as routing_router
from app.api.routing_orders import router as routing_orders_router
from app.api.sync import router as sync_router
from app.api.vehicles import router as vehicles_router
from app.api.mantis import router as mantis_router
from app.api.roles import router as roles_router
from app.api.users import router as users_router
from app.api.warehouses import router as warehouses_router
from app.api.audit import router as audit_router
from app.api.driver import router as driver_router
from app.api.pod import router as pod_router
from app.api.user_preferences import router as user_preferences_router
from app.api.qr_documents import router as qr_router
from app.core.deps import get_current_active_user

api_router = APIRouter()

# Public routes (no auth required)
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(health_router, tags=["health"])

# Protected routes (require authenticated active user)
_auth = [Depends(get_current_active_user)]
api_router.include_router(sync_router, tags=["sync"], dependencies=_auth)
api_router.include_router(orders_router, tags=["orders"], dependencies=_auth)
api_router.include_router(items_router, tags=["items"], dependencies=_auth)
api_router.include_router(regions_router, tags=["regions"], dependencies=_auth)
api_router.include_router(vehicles_router, tags=["vehicles"], dependencies=_auth)
api_router.include_router(routing_router, tags=["routing"], dependencies=_auth)
api_router.include_router(routing_orders_router, tags=["routing-orders"], dependencies=_auth)
api_router.include_router(config_router, tags=["config"], dependencies=_auth)
api_router.include_router(mantis_router, tags=["mantis"], dependencies=_auth)
api_router.include_router(roles_router, tags=["roles"], dependencies=_auth)
api_router.include_router(users_router, tags=["users"], dependencies=_auth)
api_router.include_router(warehouses_router, tags=["warehouses"], dependencies=_auth)
api_router.include_router(audit_router, tags=["audit"], dependencies=_auth)
api_router.include_router(pod_router, tags=["pod"], dependencies=_auth)
api_router.include_router(user_preferences_router, tags=["user-preferences"], dependencies=_auth)
api_router.include_router(driver_router, tags=["driver"])
api_router.include_router(qr_router, tags=["qr"], dependencies=_auth)
