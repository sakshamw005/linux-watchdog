from fastapi import APIRouter, Depends
from app.database import get_db
from app.services.health_engine import HealthEngine
from app.schemas import HealthResponse, SystemMetricsSchema
from typing import Optional
import sqlite3

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/health", response_model=HealthResponse)
def get_system_health():
    with get_db() as conn:
        return HealthEngine.calculate_health(conn)

@router.get("/system", response_model=Optional[SystemMetricsSchema])
def get_latest_system_metrics():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 1;")
        row = cursor.fetchone()
        if not row:
            return None
        return SystemMetricsSchema(**dict(row))
