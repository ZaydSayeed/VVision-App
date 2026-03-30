import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.database import connect_db, close_db
from .routers import (
    auth,
    patients,
    people,
    alerts,
    stream,
    routines,
    medications,
    help_alerts,
    caregiver_profiles,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vvision-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Connecting to MongoDB...")
    await connect_db()
    logger.info("MongoDB connected")
    yield
    await close_db()
    logger.info("MongoDB disconnected")


app = FastAPI(
    title="Vela Vision API",
    description="Backend API for the Vela Vision caregiver mobile app",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the mobile app and web clients to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(people.router)
app.include_router(alerts.router)
app.include_router(stream.router)
app.include_router(routines.router)
app.include_router(medications.router)
app.include_router(help_alerts.router)
app.include_router(caregiver_profiles.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
