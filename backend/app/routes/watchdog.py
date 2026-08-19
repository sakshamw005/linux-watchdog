from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.schemas import (
    AgentMetricsPayload,
    EventCreate,
    WatchdogActionCreate,
    WatchdogActionSchema
)
from app.services.diagnostic_engine import RuleBasedDiagnosticEngine
from datetime import datetime, timezone
from typing import List, Dict, Any

router = APIRouter(prefix="/api", tags=["watchdog"])

@router.get("/watchdog/status")
def get_watchdog_status():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check last metrics ingestion
        cursor.execute("SELECT timestamp FROM system_metrics ORDER BY timestamp DESC LIMIT 1;")
        last_metric = cursor.fetchone()
        
        is_agent_alive = False
        last_seen = None
        if last_metric:
            last_seen = last_metric["timestamp"]
            # Check if within last 15 seconds
            try:
                # ISO format
                ts_clean = last_seen.replace("Z", "+00:00")
                dt = datetime.fromisoformat(ts_clean)
                now = datetime.now(timezone.utc)
                if (now - dt).total_seconds() <= 15:
                    is_agent_alive = True
            except Exception:
                is_agent_alive = True

        # Total restarts
        cursor.execute("SELECT COUNT(*) as total_restarts FROM watchdog_actions WHERE action = 'RESTART' AND result = 'SUCCESS';")
        total_restarts = cursor.fetchone()["total_restarts"]

        # Active monitored processes
        cursor.execute("""
            SELECT DISTINCT process_name, pid, state, cpu_percent, memory_percent, uptime_seconds
            FROM process_metrics
            WHERE is_monitored = 1 AND timestamp = (SELECT MAX(timestamp) FROM process_metrics)
        """)
        monitored_procs = [dict(r) for r in cursor.fetchall()]

        # Recent watchdog actions
        cursor.execute("SELECT * FROM watchdog_actions ORDER BY timestamp DESC LIMIT 10;")
        recent_actions = [dict(r) for r in cursor.fetchall()]

        # Active critical/warning alerts count
        cursor.execute("""
            SELECT COUNT(*) as active_alerts FROM events 
            WHERE severity IN ('WARNING', 'CRITICAL') 
            AND datetime(timestamp) >= datetime('now', '-5 minutes');
        """)
        active_alerts = cursor.fetchone()["active_alerts"]

        return {
            "agent_connected": is_agent_alive,
            "last_heartbeat": last_seen,
            "total_restarts": total_restarts,
            "active_alerts": active_alerts,
            "monitored_processes": monitored_procs,
            "recent_actions": recent_actions
        }

@router.post("/agent/metrics")
def ingest_agent_metrics(payload: AgentMetricsPayload):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Insert system metrics
        s = payload.system
        cursor.execute("""
            INSERT INTO system_metrics (
                timestamp, cpu_percent, memory_total_bytes, memory_used_bytes,
                memory_available_bytes, memory_percent, disk_total_bytes,
                disk_used_bytes, disk_percent, load_1m, load_5m, load_15m,
                net_rx_bytes, net_tx_bytes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            s.timestamp, s.cpu_percent, s.memory_total_bytes, s.memory_used_bytes,
            s.memory_available_bytes, s.memory_percent, s.disk_total_bytes,
            s.disk_used_bytes, s.disk_percent, s.load_1m, s.load_5m, s.load_15m,
            s.net_rx_bytes, s.net_tx_bytes
        ))

        # 2. Insert monitored processes
        for p in payload.monitored_processes:
            cursor.execute("""
                INSERT INTO process_metrics (
                    timestamp, pid, process_name, state, ppid,
                    cpu_percent, memory_bytes, vm_size_bytes, memory_percent,
                    thread_count, uptime_seconds, cmdline, is_monitored
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
            """, (
                s.timestamp, p.pid, p.name, p.state, p.ppid,
                p.cpu_percent, p.memory_bytes, p.vm_size_bytes, p.memory_percent,
                p.thread_count, p.uptime_seconds, p.cmdline
            ))

        # 3. Insert other top processes
        monitored_pids = {p.pid for p in payload.monitored_processes}
        for p in payload.all_processes:
            if p.pid not in monitored_pids:
                cursor.execute("""
                    INSERT INTO process_metrics (
                        timestamp, pid, process_name, state, ppid,
                        cpu_percent, memory_bytes, vm_size_bytes, memory_percent,
                        thread_count, uptime_seconds, cmdline, is_monitored
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);
                """, (
                    s.timestamp, p.pid, p.name, p.state, p.ppid,
                    p.cpu_percent, p.memory_bytes, p.vm_size_bytes, p.memory_percent,
                    p.thread_count, p.uptime_seconds, p.cmdline
                ))

        return {"status": "SUCCESS", "message": "Metrics ingested"}

@router.post("/agent/events")
def ingest_agent_event(event: EventCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        ts = event.timestamp or datetime.now(timezone.utc).isoformat()
        
        # Rule-based diagnostic evaluation
        e_dict = event.model_dump()
        e_dict["timestamp"] = ts
        diag = RuleBasedDiagnosticEngine.analyze_event(e_dict, conn)
        
        diag_str = diag.probable_cause
        evidence_str = " | ".join(diag.evidence)

        cursor.execute("""
            INSERT INTO events (
                timestamp, pid, process_name, event_type, severity,
                value, threshold, message, diagnosis, evidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            ts, event.pid, event.process_name, event.event_type, event.severity,
            event.value, event.threshold, event.message, diag_str, evidence_str
        ))
        
        return {
            "status": "SUCCESS",
            "event_id": cursor.lastrowid,
            "diagnosis": diag.model_dump()
        }

@router.post("/agent/actions")
def ingest_agent_action(action: WatchdogActionCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        ts = action.timestamp or datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            INSERT INTO watchdog_actions (
                timestamp, pid, process_name, action, result, message
            ) VALUES (?, ?, ?, ?, ?, ?);
        """, (
            ts, action.pid, action.process_name, action.action, action.result, action.message
        ))
        return {"status": "SUCCESS", "action_id": cursor.lastrowid}
