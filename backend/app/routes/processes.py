from fastapi import APIRouter, HTTPException, Query
from app.database import get_db
from app.schemas import ProcessInfoSchema
from typing import List, Optional, Dict, Any
import os
import signal

router = APIRouter(prefix="/api/processes", tags=["processes"])

@router.get("", response_model=List[ProcessInfoSchema])
def get_processes(monitored_only: bool = Query(False, description="Filter only monitored processes")):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get latest timestamp in process_metrics
        cursor.execute("SELECT timestamp FROM process_metrics ORDER BY timestamp DESC LIMIT 1;")
        latest_row = cursor.fetchone()
        if not latest_row:
            return []
        
        latest_ts = latest_row["timestamp"]
        
        if monitored_only:
            cursor.execute("""
                SELECT * FROM process_metrics
                WHERE timestamp = ? AND is_monitored = 1
                ORDER BY cpu_percent DESC;
            """, (latest_ts,))
        else:
            cursor.execute("""
                SELECT * FROM process_metrics
                WHERE timestamp = ?
                ORDER BY is_monitored DESC, (cpu_percent + memory_percent) DESC;
            """, (latest_ts,))
            
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["name"] = d.get("process_name", "")
            d["is_monitored"] = bool(d.get("is_monitored", 0))
            result.append(ProcessInfoSchema(**d))
        return result

@router.get("/{pid}")
def get_process_detail(pid: int):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Latest info
        cursor.execute("""
            SELECT * FROM process_metrics
            WHERE pid = ?
            ORDER BY timestamp DESC LIMIT 1;
        """, (pid,))
        proc_row = cursor.fetchone()
        if not proc_row:
            raise HTTPException(status_code=404, detail=f"Process with PID {pid} not found in metrics history")
        
        proc_dict = dict(proc_row)
        proc_name = proc_dict.get("process_name", "")
        
        # Recent metric history (last 50 samples)
        cursor.execute("""
            SELECT timestamp, cpu_percent, memory_percent, memory_bytes, thread_count
            FROM process_metrics
            WHERE pid = ?
            ORDER BY timestamp DESC LIMIT 50;
        """, (pid,))
        history = [dict(r) for r in cursor.fetchall()]
        history.reverse() # chronological
        
        # Correlated events
        cursor.execute("""
            SELECT * FROM events
            WHERE pid = ? OR process_name = ?
            ORDER BY timestamp DESC LIMIT 20;
        """, (pid, proc_name))
        events = [dict(r) for r in cursor.fetchall()]
        
        # Watchdog actions
        cursor.execute("""
            SELECT * FROM watchdog_actions
            WHERE pid = ? OR process_name = ?
            ORDER BY timestamp DESC LIMIT 10;
        """, (pid, proc_name))
        actions = [dict(r) for r in cursor.fetchall()]
        
        return {
            "process": proc_dict,
            "history": history,
            "events": events,
            "actions": actions
        }

@router.post("/{pid}/restart")
def restart_process(pid: int):
    # Try terminating with SIGTERM / SIGKILL to let watchdog restart it
    try:
        os.kill(pid, signal.SIGTERM)
        return {"status": "SUCCESS", "message": f"Sent SIGTERM to process {pid}. Watchdog will handle recovery."}
    except ProcessLookupError:
        raise HTTPException(status_code=404, detail=f"Process PID {pid} not currently active in OS")
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied to signal process {pid}")
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}
