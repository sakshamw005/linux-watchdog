from fastapi import APIRouter, Query, HTTPException
from app.database import get_db
from app.schemas import SystemMetricsSchema
from typing import List, Dict, Any

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

@router.get("/system", response_model=List[SystemMetricsSchema])
def get_system_metrics_history(
    limit: int = Query(60, ge=1, le=500, description="Max number of samples to retrieve")
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM system_metrics
            ORDER BY timestamp DESC
            LIMIT ?;
        """, (limit,))
        rows = cursor.fetchall()
        result = [SystemMetricsSchema(**dict(r)) for r in rows]
        result.reverse() # Return chronological order
        return result

@router.get("/process/{pid}")
def get_process_metrics_history(
    pid: int,
    limit: int = Query(60, ge=1, le=500)
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, pid, process_name, cpu_percent, memory_percent, memory_bytes, thread_count
            FROM process_metrics
            WHERE pid = ?
            ORDER BY timestamp DESC
            LIMIT ?;
        """, (pid, limit))
        rows = cursor.fetchall()
        result = [dict(r) for r in rows]
        result.reverse()
        return result

@router.get("/process/by-name/{name}")
def get_process_metrics_by_name(
    name: str,
    limit: int = Query(100, ge=1, le=500)
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, pid, process_name, cpu_percent, memory_percent, memory_bytes, thread_count
            FROM process_metrics
            WHERE process_name = ?
            ORDER BY timestamp DESC
            LIMIT ?;
        """, (name, limit))
        rows = cursor.fetchall()
        result = [dict(r) for r in rows]
        result.reverse()
        return result
