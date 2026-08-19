import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { IncidentGroup } from '../types';
import { DiagnosticCard } from '../components/DiagnosticCard';
import { 
  GitCommit, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Cpu, 
  ShieldAlert, 
  Clock, 
  Activity,
  Layers
} from 'lucide-react';

export const IncidentTimelinePage: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = () => {
    setLoading(true);
    api.getIncidents(15)
      .then((res) => setIncidents(res))
      .catch((err) => console.error('Failed to fetch incidents', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="cyber-card p-5">
        <h2 className="text-lg font-bold font-mono text-white flex items-center space-x-2">
          <GitCommit className="w-5 h-5 text-cyan-400" />
          <span>Forensic Incident Timelines</span>
        </h2>
        <p className="text-xs font-mono text-slate-400 mt-1">
          Chronological multi-stage breakdown of process anomalies, pre-crash metrics, watchdog restarts, and deterministic diagnosis.
        </p>
      </div>

      {loading && incidents.length === 0 ? (
        <div className="cyber-card p-12 text-center text-xs font-mono text-slate-500">
          Loading incident timelines...
        </div>
      ) : incidents.length === 0 ? (
        <div className="cyber-card p-12 text-center font-mono">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Active Incidents Detected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The watchdog engine has not registered critical crashes or threshold violations in the recent observation window.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {incidents.map((inc) => (
            <div key={inc.incident_id} className="cyber-card p-6 border-slate-800 font-mono">
              {/* Incident Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-800 gap-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                    inc.severity === 'CRITICAL'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'bg-amber-500 text-black'
                  }`}>
                    {inc.incident_id}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Incident on '{inc.process_name}'
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{inc.summary}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${
                    inc.status === 'RESOLVED'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                      : 'bg-rose-950/80 text-rose-400 border-rose-800'
                  }`}>
                    {inc.status === 'RESOLVED' ? 'WATCHDOG RECOVERED' : 'INCIDENT ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Vertical Chronological Timeline */}
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 mb-6">
                {inc.timeline.map((item, idx) => {
                  let dotColor = 'bg-cyan-400';
                  let icon = <Activity className="w-3 h-3 text-cyan-400" />;

                  if (item.type === 'CRASH') {
                    dotColor = 'bg-rose-500';
                    icon = <AlertTriangle className="w-3 h-3 text-rose-400" />;
                  } else if (item.type === 'RESTART') {
                    dotColor = 'bg-emerald-400';
                    icon = <RotateCcw className="w-3 h-3 text-emerald-400" />;
                  } else if (item.type === 'ALERT') {
                    dotColor = 'bg-amber-400';
                    icon = <ShieldAlert className="w-3 h-3 text-amber-400" />;
                  } else if (item.type === 'RECOVERY') {
                    dotColor = 'bg-emerald-400';
                    icon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
                  }

                  return (
                    <div key={idx} className="relative group">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full ${dotColor} border-2 border-slate-900 shadow-sm`} />

                      {/* Card Content */}
                      <div className="bg-slate-950/70 hover:bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 transition-colors">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center space-x-2 font-bold text-white">
                            {icon}
                            <span>{item.title}</span>
                          </div>
                          <span className="text-slate-500 text-[11px]">
                            {item.timestamp.slice(11, 19)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Embedded Root Cause Diagnosis */}
              {inc.diagnostic && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <DiagnosticCard diagnostic={inc.diagnostic} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
