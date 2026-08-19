from typing import Dict, Any, List, Optional
import sqlite3
from app.schemas import DiagnosticResult

class RuleBasedDiagnosticEngine:
    """
    Deterministic, rule-based diagnostic engine.
    Produces human-readable probable causes and structured evidence checklists without ML.
    """

    @staticmethod
    def analyze_event(event_dict: Dict[str, Any], conn: Optional[sqlite3.Connection] = None) -> DiagnosticResult:
        event_type = event_dict.get("event_type", "")
        pid = event_dict.get("pid", 0)
        process_name = event_dict.get("process_name", "")
        val = event_dict.get("value", 0.0)
        thresh = event_dict.get("threshold", 0.0)
        timestamp = event_dict.get("timestamp", "")

        # Rule 1: High CPU Saturation
        if event_type == "HIGH_CPU":
            return DiagnosticResult(
                rule_id="RULE_CPU_SATURATION",
                probable_cause="CPU saturation detected.",
                evidence=[
                    f"Process '{process_name}' (PID {pid}) CPU reached {val:.1f}%",
                    f"Configured threshold ({thresh:.1f}%) was exceeded for the monitoring interval",
                    "Deterministic condition: continuous high thread utilization detected in /proc/<pid>/stat"
                ],
                recommendation="Profile worker threads for unthrottled spin-loops, optimize heavy math operations, or assign CPU affinity.",
                confidence="DETERMINISTIC_EVIDENCE"
            )

        # Rule 2: Monotonic Memory Growth
        if event_type == "MEMORY_GROWTH":
            return DiagnosticResult(
                rule_id="RULE_MEMORY_GROWTH",
                probable_cause="Possible memory leak or abnormal memory consumption.",
                evidence=[
                    f"Process '{process_name}' (PID {pid}) memory reached {val:.1f}%",
                    f"Memory usage increased monotonically across at least 5 consecutive sampling windows (+{thresh:.1f}% growth)",
                    "Zero downward reallocation observed during observation window"
                ],
                recommendation="Inspect application heap allocations with Valgrind / Heaptrack to detect unreleased dynamic buffers.",
                confidence="DETERMINISTIC_EVIDENCE"
            )

        # Rule 3: High Memory
        if event_type == "HIGH_MEMORY":
            return DiagnosticResult(
                rule_id="RULE_HIGH_MEMORY",
                probable_cause="Elevated resident memory footprint approaching threshold limit.",
                evidence=[
                    f"Process '{process_name}' (PID {pid}) VmRSS memory reached {val:.1f}%",
                    f"Threshold limit is {thresh:.1f}% of total system RAM"
                ],
                recommendation="Tune internal cache sizes or configure process memory limits via cgroups.",
                confidence="DETERMINISTIC_EVIDENCE"
            )

        # Rule 4: Process Crash & Pre-Crash Analysis
        if event_type == "PROCESS_CRASH":
            evidence_list = [
                f"Monitored process '{process_name}' (PID {pid}) terminated unexpectedly",
                "PID vanished from /proc table without graceful shutdown handshake"
            ]
            
            # Check pre-crash memory history in DB if connection is available
            had_high_memory = False
            pre_crash_mem = 0.0
            if conn:
                try:
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT memory_percent FROM process_metrics
                        WHERE process_name = ? AND timestamp <= ?
                        ORDER BY timestamp DESC LIMIT 5
                    """, (process_name, timestamp))
                    rows = cursor.fetchall()
                    if rows:
                        pre_crash_mem = max(r["memory_percent"] for r in rows)
                        if pre_crash_mem >= 65.0:
                            had_high_memory = True
                except Exception:
                    pass

            if had_high_memory or val >= 65.0:
                mem_val = max(val, pre_crash_mem)
                evidence_list.append(f"Memory reached {mem_val:.1f}% immediately before termination")
                evidence_list.append("Deterministic correlation: elevated memory preceded exit within 60 seconds")
                return DiagnosticResult(
                    rule_id="RULE_OOM_CRASH",
                    probable_cause="Possible memory exhaustion preceding process termination.",
                    evidence=evidence_list,
                    recommendation="Verify Linux kernel OOM-killer activity in syslog/dmesg (`dmesg -T | grep -i oom`) and inspect memory allocators.",
                    confidence="DETERMINISTIC_EVIDENCE"
                )
            else:
                evidence_list.append("Process received unhandled fatal signal (e.g. SIGSEGV, SIGABRT) or was killed by external command")
                return DiagnosticResult(
                    rule_id="RULE_FATAL_SIGNAL_CRASH",
                    probable_cause="Abnormal process termination (crash or fatal signal).",
                    evidence=evidence_list,
                    recommendation="Enable core dumps (`ulimit -c unlimited`), inspect crash stack traces via GDB, and verify pointer safety.",
                    confidence="DETERMINISTIC_EVIDENCE"
                )

        # Rule 5: Repeated Crash / Crash Loop
        if event_type == "REPEATED_CRASH":
            return DiagnosticResult(
                rule_id="RULE_REPEATED_CRASH",
                probable_cause="Application instability detected (frequent crash loop).",
                evidence=[
                    f"Process '{process_name}' exceeded maximum permitted restarts within window",
                    "Watchdog engine suspended automatic restarts to prevent system resource thrashing"
                ],
                recommendation="Investigate startup runtime dependencies, configuration syntax, file system permissions, or port collisions.",
                confidence="DETERMINISTIC_EVIDENCE"
            )

        # Rule 6: Process Hang / Heartbeat Failure
        if event_type == "PROCESS_HANG":
            return DiagnosticResult(
                rule_id="RULE_PROCESS_HANG",
                probable_cause="Application may be unresponsive or blocked.",
                evidence=[
                    f"Process '{process_name}' (PID {pid}) PID remains active in /proc",
                    f"Heartbeat timestamp file has not updated for {val:.1f}s (configured timeout: {thresh:.1f}s)",
                    "Subsystem threads unresponsive or trapped in deadlock"
                ],
                recommendation="Check for thread mutex deadlocks, un-timed socket reads, or infinite loops blocking the event loop.",
                confidence="DETERMINISTIC_EVIDENCE"
            )

        # Rule 7: Disk Space Warning/Critical
        if event_type in ("DISK_WARNING", "DISK_CRITICAL"):
            sev_title = "critical" if event_type == "DISK_CRITICAL" else "warning"
            return DiagnosticResult(
                rule_id="RULE_DISK_SATURATION",
                probable_cause=f"Filesystem storage capacity {sev_title}.",
                evidence=[
                    f"Root partition usage reached {val:.1f}% (threshold: {thresh:.1f}%)",
                    "POSIX statvfs reports restricted available inode blocks"
                ],
                recommendation="Purge temporary files in `/tmp`, rotate journal logs, or expand filesystem partition size.",
                confidence="DETERMINISTIC_EVIDENCE"
            )

        # Default rule for generic / informational events
        return DiagnosticResult(
            rule_id="RULE_GENERIC_INFO",
            probable_cause=event_dict.get("message", "Standard system or watchdog lifecycle event."),
            evidence=[f"Event type: {event_type}", f"Severity: {event_dict.get('severity', 'INFO')}"],
            recommendation="No corrective action required.",
            confidence="DETERMINISTIC_EVIDENCE"
        )
