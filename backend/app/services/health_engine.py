import sqlite3
from typing import Dict, Any, List
from app.schemas import HealthResponse, HealthPenalty

class HealthEngine:
    """
    Deterministic system health scoring engine.
    Calculates explainable health score (0-100) based on rule-based penalty deductions.
    """

    @staticmethod
    def calculate_health(conn: sqlite3.Connection) -> HealthResponse:
        cursor = conn.cursor()
        score = 100
        penalties: List[HealthPenalty] = []

        # 1. Check latest system metrics
        cursor.execute("SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 1;")
        latest_sys = cursor.fetchone()
        
        sys_dict: Dict[str, Any] = {}
        if latest_sys:
            sys_dict = dict(latest_sys)
            cpu = latest_sys["cpu_percent"]
            mem = latest_sys["memory_percent"]
            disk = latest_sys["disk_percent"]

            if cpu >= 90.0:
                penalties.append(HealthPenalty(
                    reason=f"High System CPU usage ({cpu:.1f}%)",
                    points_deducted=15,
                    severity="WARNING"
                ))
                score -= 15
            elif cpu >= 75.0:
                penalties.append(HealthPenalty(
                    reason=f"Elevated System CPU usage ({cpu:.1f}%)",
                    points_deducted=5,
                    severity="INFO"
                ))
                score -= 5

            if mem >= 85.0:
                penalties.append(HealthPenalty(
                    reason=f"Critical System Memory pressure ({mem:.1f}%)",
                    points_deducted=20,
                    severity="WARNING"
                ))
                score -= 20
            elif mem >= 75.0:
                penalties.append(HealthPenalty(
                    reason=f"High System Memory consumption ({mem:.1f}%)",
                    points_deducted=10,
                    severity="INFO"
                ))
                score -= 10

            if disk >= 95.0:
                penalties.append(HealthPenalty(
                    reason=f"Critical Disk usage ({disk:.1f}%)",
                    points_deducted=25,
                    severity="CRITICAL"
                ))
                score -= 25
            elif disk >= 85.0:
                penalties.append(HealthPenalty(
                    reason=f"High Disk usage warning ({disk:.1f}%)",
                    points_deducted=10,
                    severity="WARNING"
                ))
                score -= 10

        # 2. Check real-time monitored process states
        cursor.execute("""
            SELECT DISTINCT process_name, pid, state 
            FROM process_metrics 
            WHERE is_monitored = 1 
            AND timestamp = (SELECT MAX(timestamp) FROM process_metrics)
        """)
        monitored_rows = cursor.fetchall()
        
        for row in monitored_rows:
            pname = row["process_name"]
            pid = row["pid"]
            state = row["state"]
            
            # Get the latest event for this process to check if it's in an active error state
            cursor.execute("""
                SELECT event_type, severity 
                FROM events 
                WHERE process_name = ? 
                ORDER BY timestamp DESC LIMIT 1
            """, (pname,))
            latest_ev = cursor.fetchone()
            
            # Case 1: Process is not running (crashed/stopped)
            if state not in ("RUNNING", "S", "R", "D"):
                pts = 25
                penalties.append(HealthPenalty(
                    reason=f"Monitored process '{pname}' is not running (State: {state})",
                    points_deducted=pts,
                    severity="CRITICAL"
                ))
                score -= pts
            
            # Case 2: Process is running but has an active hang or crash loop
            elif latest_ev:
                etype = latest_ev["event_type"]
                
                if etype == "PROCESS_HANG":
                    pts = 30
                    penalties.append(HealthPenalty(
                        reason=f"Active hang detected on process '{pname}' (PID {pid})",
                        points_deducted=pts,
                        severity="CRITICAL"
                    ))
                    score -= pts
                elif etype == "REPEATED_CRASH":
                    pts = 30
                    penalties.append(HealthPenalty(
                        reason=f"Process '{pname}' is in a repeated crash loop (restarts disabled)",
                        points_deducted=pts,
                        severity="CRITICAL"
                    ))
                    score -= pts

        # 3. Check for active warning/resource alerts in the last 2 minutes
        cursor.execute("""
            SELECT event_type, process_name, value, threshold
            FROM events
            WHERE event_type IN ('HIGH_CPU', 'HIGH_MEMORY', 'MEMORY_GROWTH')
            AND datetime(timestamp) >= datetime('now', '-2 minutes')
            GROUP BY event_type, process_name
        """)
        warning_rows = cursor.fetchall()
        for row in warning_rows:
            etype = row["event_type"]
            pname = row["process_name"]
            val = row["value"]
            thresh = row["threshold"]
            
            pts = 10
            penalties.append(HealthPenalty(
                reason=f"Active {etype} warning on process '{pname}' ({val:.1f}% >= {thresh:.1f}%)",
                points_deducted=pts,
                severity="WARNING"
            ))
            score -= pts

        # Clamp score between 0 and 100
        score = max(0, min(100, score))

        if score >= 70:
            status = "HEALTHY"
            summary = "All monitored services and system resources are operating within acceptable thresholds."
        elif score >= 40:
            status = "DEGRADED"
            summary = "System performance degraded due to resource thresholds or non-fatal anomalies."
        else:
            status = "CRITICAL"
            summary = "System in critical condition: process crash, hang, or severe resource starvation detected."

        return HealthResponse(
            score=score,
            status=status,
            summary=summary,
            penalties=penalties,
            metrics=sys_dict
        )
