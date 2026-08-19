export interface SystemMetrics {
  timestamp: string;
  cpu_percent: number;
  memory_total_bytes: number;
  memory_used_bytes: number;
  memory_available_bytes: number;
  memory_percent: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_percent: number;
  load_1m: number;
  load_5m: number;
  load_15m: number;
  net_rx_bytes?: number;
  net_tx_bytes?: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  state: string;
  ppid?: number;
  cpu_percent: number;
  memory_bytes: number;
  vm_size_bytes?: number;
  memory_percent: number;
  thread_count?: number;
  uptime_seconds?: number;
  cmdline?: string;
  is_monitored?: boolean;
}

export interface DiagnosticResult {
  rule_id: string;
  probable_cause: string;
  evidence: string[];
  recommendation: string;
  confidence: string;
}

export interface EventItem {
  id: number;
  timestamp: string;
  pid?: number;
  process_name: string;
  event_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  value: number;
  threshold: number;
  message: string;
  diagnosis?: string;
  evidence?: string;
  diagnostic?: DiagnosticResult;
}

export interface WatchdogAction {
  id: number;
  timestamp: string;
  pid: number;
  process_name: string;
  action: string;
  result: string;
  message: string;
}

export interface HealthPenalty {
  reason: string;
  points_deducted: number;
  severity: string;
}

export interface HealthResponse {
  score: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  summary: string;
  penalties: HealthPenalty[];
  metrics: Record<string, any>;
}

export interface WatchdogStatus {
  agent_connected: boolean;
  last_heartbeat: string | null;
  total_restarts: number;
  active_alerts: number;
  monitored_processes: ProcessInfo[];
  recent_actions: WatchdogAction[];
}

export interface IncidentTimelineItem {
  timestamp: string;
  type: 'METRIC' | 'ALERT' | 'CRASH' | 'RESTART' | 'RECOVERY';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  pid?: number;
  process_name?: string;
  value?: number;
  diagnosis?: DiagnosticResult;
}

export interface IncidentGroup {
  incident_id: string;
  process_name: string;
  start_time: string;
  end_time?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED';
  summary: string;
  diagnostic?: DiagnosticResult;
  timeline: IncidentTimelineItem[];
}
