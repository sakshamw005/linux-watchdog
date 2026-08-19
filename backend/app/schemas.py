from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SystemMetricsSchema(BaseModel):
    timestamp: str
    cpu_percent: float
    memory_total_bytes: int
    memory_used_bytes: int
    memory_available_bytes: int
    memory_percent: float
    disk_total_bytes: int
    disk_used_bytes: int
    disk_percent: float
    load_1m: float
    load_5m: float
    load_15m: float
    net_rx_bytes: Optional[int] = 0
    net_tx_bytes: Optional[int] = 0

class ProcessInfoSchema(BaseModel):
    pid: int
    name: str
    state: str
    ppid: Optional[int] = 0
    cpu_percent: float
    memory_bytes: int
    vm_size_bytes: Optional[int] = 0
    memory_percent: float
    thread_count: Optional[int] = 1
    start_time_ticks: Optional[int] = 0
    uptime_seconds: Optional[float] = 0.0
    cmdline: Optional[str] = ""
    is_monitored: Optional[bool] = False

class AgentMetricsPayload(BaseModel):
    system: SystemMetricsSchema
    monitored_processes: List[ProcessInfoSchema] = []
    all_processes: List[ProcessInfoSchema] = []

class EventCreate(BaseModel):
    timestamp: Optional[str] = None
    pid: Optional[int] = 0
    process_name: str
    event_type: str
    severity: str
    value: Optional[float] = 0.0
    threshold: Optional[float] = 0.0
    message: str
    diagnosis: Optional[str] = ""
    evidence: Optional[str] = ""

class EventSchema(EventCreate):
    id: int
    timestamp: str

class WatchdogActionCreate(BaseModel):
    timestamp: Optional[str] = None
    pid: Optional[int] = 0
    process_name: str
    action: str
    result: str
    message: Optional[str] = ""

class WatchdogActionSchema(WatchdogActionCreate):
    id: int
    timestamp: str

class DiagnosticResult(BaseModel):
    rule_id: str
    probable_cause: str
    evidence: List[str]
    recommendation: str
    confidence: str = "DETERMINISTIC_EVIDENCE"

class HealthPenalty(BaseModel):
    reason: str
    points_deducted: int
    severity: str

class HealthResponse(BaseModel):
    score: int
    status: str # "HEALTHY", "DEGRADED", "CRITICAL"
    summary: str
    penalties: List[HealthPenalty]
    metrics: Dict[str, Any]

class IncidentTimelineItem(BaseModel):
    timestamp: str
    type: str # "METRIC", "ALERT", "CRASH", "RESTART", "RECOVERY"
    severity: str # "INFO", "WARNING", "CRITICAL"
    title: str
    description: str
    pid: Optional[int] = None
    process_name: Optional[str] = None
    value: Optional[float] = None
    diagnosis: Optional[DiagnosticResult] = None

class IncidentGroup(BaseModel):
    incident_id: str
    process_name: str
    start_time: str
    end_time: Optional[str] = None
    severity: str
    status: str # "RESOLVED", "ACTIVE"
    summary: str
    diagnostic: Optional[DiagnosticResult] = None
    timeline: List[IncidentTimelineItem]
