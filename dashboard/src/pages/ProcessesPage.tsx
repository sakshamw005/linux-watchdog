import React, { useState } from 'react';
import { ProcessInfo } from '../types';
import { 
  Search, 
  Cpu, 
  RotateCcw, 
  Info, 
  Layers, 
  Filter,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface ProcessesPageProps {
  processes: ProcessInfo[];
  onSelectProcess: (pid: number) => void;
  onRestartProcess: (pid: number) => void;
}

export const ProcessesPage: React.FC<ProcessesPageProps> = ({
  processes,
  onSelectProcess,
  onRestartProcess,
}) => {
  const [search, setSearch] = useState('');
  const [filterMonitoredOnly, setFilterMonitoredOnly] = useState(false);

  const filtered = processes.filter((p) => {
    if (filterMonitoredOnly && !p.is_monitored) return false;
    if (search.trim() === '') return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.pid.toString().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="cyber-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold font-mono text-white flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>Linux Process Monitor (/proc)</span>
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Active processes inspected via Linux /proc directory tree
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search PID or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setFilterMonitoredOnly(!filterMonitoredOnly)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                filterMonitoredOnly
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{filterMonitoredOnly ? 'Monitored Only' : 'All Processes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div className="cyber-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">PID</th>
                <th className="py-3 px-4">Process Name</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4 text-right">CPU %</th>
                <th className="py-3 px-4 text-right">Memory (RSS)</th>
                <th className="py-3 px-4 text-right">RAM %</th>
                <th className="py-3 px-4 text-right">Threads</th>
                <th className="py-3 px-4 text-right">Uptime</th>
                <th className="py-3 px-4 text-center">Watchdog Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No processes matching query.
                  </td>
                </tr>
              ) : (
                filtered.map((proc) => {
                  const isHighCpu = proc.cpu_percent >= 80;
                  const isHighMem = proc.memory_percent >= 70;

                  return (
                    <tr
                      key={proc.pid}
                      className="hover:bg-slate-900/60 transition-colors group cursor-pointer"
                      onClick={() => onSelectProcess(proc.pid)}
                    >
                      <td className="py-3 px-4 font-bold text-cyan-400">
                        {proc.pid}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {proc.name}
                          </span>
                          {proc.is_monitored && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                              PROTECTED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800">
                          {proc.state}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${isHighCpu ? 'text-rose-400' : 'text-slate-300'}`}>
                        {proc.cpu_percent.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {(proc.memory_bytes / (1024 * 1024)).toFixed(1)} MB
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${isHighMem ? 'text-purple-400' : 'text-slate-300'}`}>
                        {proc.memory_percent.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {proc.thread_count || 1}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {Math.floor(proc.uptime_seconds || 0)}s
                      </td>
                      <td className="py-3 px-4 text-center">
                        {proc.is_monitored ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            <span>HEALTHY</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onSelectProcess(proc.pid)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                            title="View Process Details"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          {proc.is_monitored && (
                            <button
                              onClick={() => onRestartProcess(proc.pid)}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                              title="Trigger Restart"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
