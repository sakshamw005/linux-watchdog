import React, { useState } from 'react';
import { EventItem } from '../types';
import { DiagnosticCard } from '../components/DiagnosticCard';
import { 
  Bell, 
  Filter, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  AlertTriangle,
  Search
} from 'lucide-react';

interface AlertsPageProps {
  events: EventItem[];
  onSelectProcess?: (pid: number) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ events, onSelectProcess }) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  const filtered = events.filter((ev) => {
    if (selectedSeverity !== 'ALL' && ev.severity !== selectedSeverity) return false;
    if (search.trim() === '') return true;
    const q = search.toLowerCase();
    return (
      ev.process_name.toLowerCase().includes(q) ||
      ev.event_type.toLowerCase().includes(q) ||
      ev.message.toLowerCase().includes(q)
    );
  });

  const toggleExpand = (id: number) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="cyber-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold font-mono text-white flex items-center space-x-2">
              <Bell className="w-5 h-5 text-amber-400" />
              <span>Watchdog Alerts & Root Cause Diagnostics</span>
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Deterministic rule evaluation log and forensic evidence checklists
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-cyan-500 w-40 sm:w-56"
              />
            </div>

            {/* Severity Filter Buttons */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2.5 py-1 rounded transition-all ${
                    selectedSeverity === sev
                      ? sev === 'CRITICAL'
                        ? 'bg-rose-600 text-white font-bold'
                        : sev === 'WARNING'
                        ? 'bg-amber-600 text-black font-bold'
                        : 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List with Expandable Diagnostics */}
      <div className="space-y-3 font-mono">
        {filtered.length === 0 ? (
          <div className="cyber-card p-12 text-center text-slate-500 text-xs">
            No alerts matching the selected filter.
          </div>
        ) : (
          filtered.map((ev) => {
            const isCrit = ev.severity === 'CRITICAL';
            const isWarn = ev.severity === 'WARNING';
            const isExpanded = expandedEventId === ev.id;

            return (
              <div
                key={ev.id}
                className={`cyber-card overflow-hidden transition-all ${
                  isCrit
                    ? 'border-rose-900/60 bg-slate-900/90'
                    : isWarn
                    ? 'border-amber-900/60 bg-slate-900/90'
                    : 'border-slate-800'
                }`}
              >
                {/* Alert Item Header Row */}
                <div
                  onClick={() => toggleExpand(ev.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isCrit
                          ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                          : isWarn
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {ev.severity}
                    </span>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">{ev.event_type}</span>
                        <span className="text-xs text-slate-400">
                          Process: <strong className="text-cyan-400">{ev.process_name}</strong>
                          {ev.pid ? ` (PID ${ev.pid})` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{ev.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right text-xs">
                      {ev.value > 0 && (
                        <div className="text-slate-300">
                          Value: <strong className="text-white">{ev.value.toFixed(1)}</strong>
                          {ev.threshold > 0 && (
                            <span className="text-slate-500 ml-1">(Threshold: {ev.threshold.toFixed(1)})</span>
                          )}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ev.timestamp.slice(0, 19).replace('T', ' ')}
                      </div>
                    </div>

                    <button className="p-1 rounded text-slate-400 hover:text-white">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Diagnostic Drawer */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950/90 border-t border-slate-800">
                    <DiagnosticCard diagnostic={ev.diagnostic} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
