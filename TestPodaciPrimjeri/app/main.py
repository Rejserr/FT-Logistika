"""
FastAPI main application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from app.config import settings
from app.database import engine, Base
from app.api import orders, config, regions, logistics, vehicles
from app.schedulers.sync_scheduler import start_scheduler
import os

# Create tables (for development - use Alembic in production)
# Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    start_scheduler()
    yield
    # Shutdown
    pass


app = FastAPI(
    title="OptimoRout Logistics Integration",
    description="Backend za integraciju Luceed ERP-a s logističkim pravilima",
    version="1.0.0",
    lifespan=lifespan
)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include routers
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(regions.router, prefix="/api/regions", tags=["regions"])
app.include_router(logistics.router, prefix="/api/logistics", tags=["logistics"])
app.include_router(vehicles.router, prefix="/api/vehicles", tags=["vehicles"])

# Include UI routes
app.include_router(orders.ui_router, tags=["ui"])
app.include_router(config.ui_router, tags=["ui"])
app.include_router(regions.ui_router, tags=["ui"])
app.include_router(logistics.ui_router, tags=["ui"])
app.include_router(vehicles.ui_router, tags=["ui"])


@app.get("/", response_class=HTMLResponse)
async def root():
    """Root endpoint - redirect to dashboard"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <meta http-equiv="refresh" content="0; url=/dashboard">
        <title>OptimoRout</title>
    </head>
    <body>
        <p>Redirecting to <a href="/dashboard">dashboard</a>...</p>
    </body>
    </html>
    """


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
