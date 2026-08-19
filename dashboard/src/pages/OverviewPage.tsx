import React from 'react';
import { 
  SystemMetrics, 
  ProcessInfo, 
  EventItem, 
  HealthResponse, 
  WatchdogStatus 
} from '../types';
import { HealthGauge } from '../components/HealthGauge';
import { MetricCard } from '../components/MetricCard';
import { ResourceChart } from '../components/ResourceChart';
import { 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Layers, 
  RotateCcw, 
  ShieldAlert, 
  Activity,
  ArrowUpRight
} from 'lucide-react';

interface OverviewPageProps {
  system: SystemMetrics | null;
  history: SystemMetrics[];
  health: HealthResponse | null;
  status: WatchdogStatus | null;
  events: EventItem[];
  onSelectProcess: (pid: number) => void;
  onNavigateTab: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  system,
  history,
  health,
  status,
  events,
  onSelectProcess,
  onNavigateTab,
}) => {
  const monitoredProcs = status?.monitored_processes || [];
  const recentEvents = events.slice(0, 5);

  const ramUsedMB = system ? (system.memory_used_bytes / (1024 * 1024)).toFixed(0) : '0';
  const ramTotalMB = system ? (system.memory_total_bytes / (1024 * 1024)).toFixed(0) : '0';
  const diskUsedGB = system ? (system.disk_used_bytes / (1024 * 1024 * 1024)).toFixed(1) : '0';
  const diskTotalGB = system ? (system.disk_total_bytes / (1024 * 1024 * 1024)).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Top Row: Health Score + Core Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Gauge */}
        <div className="lg:col-span-1">
          <HealthGauge health={health} />
        </div>

        {/* 4 Telemetry Metric Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            title="CPU UTILIZATION"
            value={system ? `${system.cpu_percent.toFixed(1)}` : '--'}
            unit="%"
            subtitle={`Load Avg: ${system?.load_1m?.toFixed(2) || '0.00'} (1m) / ${system?.load_5m?.toFixed(2) || '0.00'} (5m)`}
            icon={Cpu}
            percent={system?.cpu_percent ?? 0}
            color={
              (system?.cpu_percent ?? 0) >= 90
                ? 'rose'
                : (system?.cpu_percent ?? 0) >= 75
                ? 'amber'
                : 'cyan'
            }
          />

          <MetricCard
            title="RAM CONSUMPTION"
            value={system ? `${system.memory_percent.toFixed(1)}` : '--'}
            unit="%"
            subtitle={`${ramUsedMB} MB used of ${ramTotalMB} MB total`}
            icon={MemoryStick}
            percent={system?.memory_percent ?? 0}
            color={
              (system?.memory_percent ?? 0) >= 85
                ? 'rose'
                : (system?.memory_percent ?? 0) >= 70
                ? 'amber'
                : 'purple'
            }
          />

          <MetricCard
            title="ROOT DISK USAGE"
            value={system ? `${system.disk_percent.toFixed(1)}` : '--'}
            unit="%"
            subtitle={`${diskUsedGB} GB used of ${diskTotalGB} GB storage`}
            icon={HardDrive}
            percent={system?.disk_percent ?? 0}
            color={(system?.disk_percent ?? 0) >= 90 ? 'rose' : 'emerald'}
          />

          <MetricCard
            title="WATCHDOG ENGINE"
            value={status?.total_restarts ?? 0}
            unit="restarts"
            subtitle={`${monitoredProcs.length} process(es) monitored under protection`}
            icon={RotateCcw}
            statusBadge={status?.agent_connected ? 'PROTECTION ACTIVE' : 'DISCONNECTED'}
            color="emerald"
          />
        </div>
      </div>

      {/* Real-time System History Chart */}
      <ResourceChart data={history} />

      {/* Bottom Row: Monitored Processes Quick View + Recent Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monitored Processes Panel */}
        <div className="cyber-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                Monitored Linux Services ({monitoredProcs.length})
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('processes')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 font-mono">
            {monitoredProcs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic">
                No configured processes currently reporting. Check agent configuration.
              </p>
            ) : (
              monitoredProcs.map((p) => (
                <div
                  key={p.pid || p.name}
                  onClick={() => onSelectProcess(p.pid)}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-slate-800 cursor-pointer transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">{p.name}</span>
                        <span className="text-xs text-slate-500">PID {p.pid}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Uptime: {Math.floor(p.uptime_seconds || 0)}s
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-cyan-400 font-bold">
                      CPU: {p.cpu_percent?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-xs text-purple-400">
                      RAM: {p.memory_percent?.toFixed(1) || '0.0'}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Watchdog Events Feed */}
        <div className="cyber-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                Recent Watchdog Events & Alarms
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('alerts')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <span>All Alerts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 font-mono">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic">
                No events or alerts generated. System running stably.
              </p>
            ) : (
              recentEvents.map((ev) => {
                const isCrit = ev.severity === 'CRITICAL';
                const isWarn = ev.severity === 'WARNING';
                return (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-lg border text-xs ${
                      isCrit
                        ? 'bg-rose-950/40 border-rose-900/60 text-rose-200'
                        : isWarn
                        ? 'bg-amber-950/40 border-amber-900/60 text-amber-200'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isCrit
                              ? 'bg-rose-500 text-white'
                              : isWarn
                              ? 'bg-amber-500 text-black'
                              : 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          {ev.severity}
                        </span>
                        <span className="font-bold">{ev.event_type}</span>
                        <span className="text-slate-400">({ev.process_name})</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {(() => {
                          try {
                            const d = new Date(ev.timestamp);
                            if (isNaN(d.getTime())) return ev.timestamp;
                            const pad = (n: number) => n.toString().padStart(2, '0');
                            return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                          } catch {
                            return ev.timestamp;
                          }
                        })()}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-1">{ev.message}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
