import {
  SystemMetrics,
  ProcessInfo,
  EventItem,
  WatchdogStatus,
  IncidentGroup,
  HealthResponse
} from '../types';

const API_BASE = '/api';

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getSystem(): Promise<SystemMetrics | null> {
    const res = await fetch(`${API_BASE}/system`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getSystemMetricsHistory(limit = 60): Promise<SystemMetrics[]> {
    const res = await fetch(`${API_BASE}/metrics/system?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getProcesses(monitoredOnly = false): Promise<ProcessInfo[]> {
    const res = await fetch(`${API_BASE}/processes?monitored_only=${monitoredOnly}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getProcessDetail(pid: number): Promise<{
    process: ProcessInfo;
    history: any[];
    events: EventItem[];
    actions: any[];
  }> {
    const res = await fetch(`${API_BASE}/processes/${pid}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async restartProcess(pid: number): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/processes/${pid}/restart`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getEvents(params?: {
    severity?: string;
    event_type?: string;
    process_name?: string;
    limit?: number;
  }): Promise<EventItem[]> {
    const query = new URLSearchParams();
    if (params?.severity) query.set('severity', params.severity);
    if (params?.event_type) query.set('event_type', params.event_type);
    if (params?.process_name) query.set('process_name', params.process_name);
    if (params?.limit) query.set('limit', params.limit.toString());

    const res = await fetch(`${API_BASE}/events?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getIncidents(limit = 10): Promise<IncidentGroup[]> {
    const res = await fetch(`${API_BASE}/events/incidents?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getWatchdogStatus(): Promise<WatchdogStatus> {
    const res = await fetch(`${API_BASE}/watchdog/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }
};
