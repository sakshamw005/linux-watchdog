import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ProcessInfo, EventItem, WatchdogAction } from '../types';
import { 
  X, 
  RotateCcw, 
  Cpu, 
  MemoryStick, 
  Terminal, 
  Clock, 
  Layers, 
  AlertTriangle, 
  CheckCircle,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface ProcessDetailModalProps {
  pid: number | null;
  onClose: () => void;
  onRestartSuccess?: () => void;
}

export const ProcessDetailModal: React.FC<ProcessDetailModalProps> = ({
  pid,
  onClose,
  onRestartSuccess,
}) => {
  const [data, setData] = useState<{
    process: ProcessInfo;
    history: any[];
    events: EventItem[];
    actions: WatchdogAction[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    api.getProcessDetail(pid)
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load process details', err))
      .finally(() => setLoading(false));
  }, [pid]);

  if (!pid) return null;

  const handleRestart = async () => {
    if (!confirm(`Trigger manual restart for process PID ${pid}?`)) return;
    setRestarting(true);
    setMsg(null);
    try {
      const res = await api.restartProcess(pid);
      setMsg(`Action executed: ${res.message}`);
      if (onRestartSuccess) onRestartSuccess();
    } catch (err: any) {
      setMsg(`Restart error: ${err.message}`);
    } finally {
      setRestarting(false);
    }
  };

  const chartData = data?.history.map((h) => {
    let t = h.timestamp;
    try {
      t = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      t = h.timestamp.slice(11, 19);
    }
    return {
      time: t,
      CPU: h.cpu_percent,
      RAM: h.memory_percent,
    };
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-5 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold font-mono text-white">
                  {data?.process.name || `PID: ${pid}`}
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                  PID {pid}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  State: {data?.process.state || 'RUNNING'}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Linux /proc process metrics & event history
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
              <span>{restarting ? 'Restarting...' : 'Restart Process'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {msg && (
            <div className="text-xs font-mono p-3 rounded bg-cyan-950/60 border border-cyan-800 text-cyan-300">
              {msg}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-xs font-mono text-slate-400">
              Loading telemetry for PID {pid}...
            </div>
          ) : (
            <>
              {/* Telemetry Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">CPU UTILIZATION</span>
                  <span className="text-lg font-bold text-cyan-400">
                    {data?.process.cpu_percent?.toFixed(1) ?? '0.0'}%
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">MEMORY (RSS)</span>
                  <span className="text-lg font-bold text-purple-400">
                    {((data?.process.memory_bytes ?? 0) / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({data?.process.memory_percent?.toFixed(1)}%)
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">THREADS & PPID</span>
                  <span className="text-lg font-bold text-slate-200">
                    {data?.process.thread_count ?? 1} thr
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    (PPID {data?.process.ppid ?? 0})
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">UPTIME</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {Math.floor(data?.process.uptime_seconds ?? 0)}s
                  </span>
                </div>
              </div>

              {/* Command line */}
              {data?.process.cmdline && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs">
                  <span className="text-slate-500 block mb-1">COMMAND LINE INVOCATION</span>
                  <span className="text-slate-300 break-all">{data.process.cmdline}</span>
                </div>
              )}

              {/* Metric History Sparkline */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-xs font-mono font-semibold text-slate-300 block mb-3">
                  Historical CPU & Memory Utilization
                </span>
                <div className="h-44 w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-slate-600">
                      No historical samples for this process instance
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 9 }} unit="%" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                        />
                        <Line type="monotone" dataKey="CPU" stroke="#38bdf8" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="RAM" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Correlated Events and Watchdog Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Events list */}
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs">
                  <span className="font-semibold text-slate-300 block mb-2">Correlated Events</span>
                  {data?.events && data.events.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {data.events.map((ev) => (
                        <div key={ev.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="font-bold text-amber-400">{ev.event_type}</span>
                            <span>{ev.timestamp.slice(11, 19)}</span>
                          </div>
                          <p className="text-slate-300">{ev.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">No abnormal events recorded.</p>
                  )}
                </div>

                {/* Watchdog Actions list */}
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs">
                  <span className="font-semibold text-slate-300 block mb-2">Watchdog Actions</span>
                  {data?.actions && data.actions.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {data.actions.map((act) => (
                        <div key={act.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="font-bold text-cyan-400">{act.action}</span>
                            <span className="text-emerald-400">{act.result}</span>
                          </div>
                          <p className="text-slate-300">{act.message || 'Action executed by agent'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">No watchdog actions logged yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
