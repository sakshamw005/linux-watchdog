from fastapi import APIRouter, Query, HTTPException
from app.database import get_db
from app.schemas import EventSchema, IncidentGroup, IncidentTimelineItem
from app.services.diagnostic_engine import RuleBasedDiagnosticEngine
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("", response_model=List[Dict[str, Any]])
def get_events(
    severity: Optional[str] = Query(None, description="Filter by severity: INFO, WARNING, CRITICAL"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    process_name: Optional[str] = Query(None, description="Filter by process name"),
    limit: int = Query(50, ge=1, le=500)
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM events WHERE 1=1"
        params = []

        if severity:
            query += " AND severity = ?"
            params.append(severity.upper())
        if event_type:
            query += " AND event_type = ?"
            params.append(event_type.upper())
        if process_name:
            query += " AND process_name = ?"
            params.append(process_name)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        result = []
        for r in rows:
            d = dict(r)
            diag = RuleBasedDiagnosticEngine.analyze_event(d, conn)
            d["diagnostic"] = diag.model_dump()
            result.append(d)
        return result

@router.get("/incidents", response_model=List[IncidentGroup])
def get_incidents(limit: int = Query(10, ge=1, le=50)):
    """
    Constructs chronological incident timeline stories around major alerts and crashes.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Find major anchor events (CRITICAL severity or crash/hang events)
        cursor.execute("""
            SELECT * FROM events
            WHERE severity = 'CRITICAL' OR event_type IN ('PROCESS_CRASH', 'PROCESS_HANG', 'REPEATED_CRASH')
            ORDER BY timestamp DESC LIMIT ?;
        """, (limit,))
        anchor_events = cursor.fetchall()
        
        incidents: List[IncidentGroup] = []
        
        for anchor in anchor_events:
            a_dict = dict(anchor)
            anchor_time = a_dict["timestamp"]
            pname = a_dict["process_name"]
            
            # Fetch surrounding events (within 3 minutes before and after)
            cursor.execute("""
                SELECT * FROM events
                WHERE process_name = ? AND timestamp >= datetime(?, '-3 minutes') AND timestamp <= datetime(?, '+3 minutes')
                ORDER BY timestamp ASC;
            """, (pname, anchor_time, anchor_time))
            surrounding_events = cursor.fetchall()
            
            # Fetch watchdog actions
            cursor.execute("""
                SELECT * FROM watchdog_actions
                WHERE process_name = ? AND timestamp >= datetime(?, '-3 minutes') AND timestamp <= datetime(?, '+3 minutes')
                ORDER BY timestamp ASC;
            """, (pname, anchor_time, anchor_time))
            surrounding_actions = cursor.fetchall()
            
            # Fetch metric samples leading up to incident
            cursor.execute("""
                SELECT timestamp, cpu_percent, memory_percent FROM process_metrics
                WHERE process_name = ? AND timestamp >= datetime(?, '-3 minutes') AND timestamp <= ?
                ORDER BY timestamp ASC LIMIT 8;
            """, (pname, anchor_time, anchor_time))
            metric_samples = cursor.fetchall()

            # Assemble timeline items
            timeline: List[IncidentTimelineItem] = []
            
            for m in metric_samples:
                timeline.append(IncidentTimelineItem(
                    timestamp=m["timestamp"],
                    type="METRIC",
                    severity="INFO",
                    title=f"Metric Snapshot ({pname})",
                    description=f"CPU: {m['cpu_percent']:.1f}%, RAM: {m['memory_percent']:.1f}%",
                    process_name=pname,
                    value=m["memory_percent"]
                ))

            for ev in surrounding_events:
                e_d = dict(ev)
                diag = RuleBasedDiagnosticEngine.analyze_event(e_d, conn)
                timeline.append(IncidentTimelineItem(
                    timestamp=e_d["timestamp"],
                    type="CRASH" if "CRASH" in e_d["event_type"] else ("ALERT" if e_d["severity"] != "INFO" else "RECOVERY"),
                    severity=e_d["severity"],
                    title=f"{e_d['event_type']} on {e_d['process_name']}",
                    description=e_d["message"],
                    pid=e_d["pid"],
                    process_name=e_d["process_name"],
                    value=e_d["value"],
                    diagnosis=diag
                ))

            for act in surrounding_actions:
                a_d = dict(act)
                timeline.append(IncidentTimelineItem(
                    timestamp=a_d["timestamp"],
                    type="RESTART",
                    severity="INFO" if a_d["result"] == "SUCCESS" else "CRITICAL",
                    title=f"Watchdog Action: {a_d['action']} ({a_d['result']})",
                    description=a_d["message"] or f"Action {a_d['action']} executed with status {a_d['result']}",
                    pid=a_d["pid"],
                    process_name=a_d["process_name"]
                ))

            # Sort items chronologically
            timeline.sort(key=lambda x: x.timestamp)
            
            diag_root = RuleBasedDiagnosticEngine.analyze_event(a_dict, conn)
            
            incidents.append(IncidentGroup(
                incident_id=f"INC-{a_dict['id']}",
                process_name=pname,
                start_time=timeline[0].timestamp if timeline else anchor_time,
                end_time=timeline[-1].timestamp if timeline else anchor_time,
                severity=a_dict["severity"],
                status="RESOLVED" if any(t.type == "RECOVERY" or (t.type == "RESTART" and "SUCCESS" in t.title) for t in timeline) else "ACTIVE",
                summary=f"Incident on '{pname}': {a_dict['event_type']} - {a_dict['message']}",
                diagnostic=diag_root,
                timeline=timeline
            ))

        return incidents

@router.get("/{event_id}")
def get_event_detail(event_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events WHERE id = ?;", (event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")
        d = dict(row)
        diag = RuleBasedDiagnosticEngine.analyze_event(d, conn)
        d["diagnostic"] = diag.model_dump()
        return d
