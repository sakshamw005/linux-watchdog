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

        # 2. Check recent alerts (last 10 minutes)
        cursor.execute("""
            SELECT event_type, severity, process_name, COUNT(*) as cnt
            FROM events
            WHERE timestamp >= datetime('now', '-10 minutes')
            GROUP BY event_type, severity, process_name
        """)
        event_rows = cursor.fetchall()
        for row in event_rows:
            sev = row["severity"]
            etype = row["event_type"]
            pname = row["process_name"]
            cnt = row["cnt"]

            if sev == "CRITICAL" or etype in ("PROCESS_CRASH", "REPEATED_CRASH", "PROCESS_HANG"):
                pts = 25
                penalties.append(HealthPenalty(
                    reason=f"Critical alert ({etype}) on process '{pname}' ({cnt} incident(s))",
                    points_deducted=pts,
                    severity="CRITICAL"
                ))
                score -= pts
            elif sev == "WARNING" or etype in ("HIGH_CPU", "HIGH_MEMORY", "MEMORY_GROWTH"):
                pts = 10
                penalties.append(HealthPenalty(
                    reason=f"Warning alert ({etype}) on process '{pname}' ({cnt} instance(s))",
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
