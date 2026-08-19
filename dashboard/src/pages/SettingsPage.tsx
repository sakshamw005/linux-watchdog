import React, { useState } from 'react';
import { WatchdogStatus } from '../types';
import { 
  Sliders, 
  ShieldCheck, 
  Cpu, 
  MemoryStick, 
  RotateCcw, 
  Play, 
  AlertTriangle,
  FileCode,
  HardDrive
} from 'lucide-react';

interface SettingsPageProps {
  status: WatchdogStatus | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ status }) => {
  const [activeFault, setActiveFault] = useState<string | null>(null);

  const rules = [
    {
      name: 'High CPU Saturation Rule',
      condition: 'Process CPU >= 90% across sampling window',
      action: 'Emit HIGH_CPU alert (WARNING), throttle duplicate alerts with 20s cooldown',
      deduction: '-10 pts health score penalty'
    },
    {
      name: 'High Resident Memory Rule',
      condition: 'Process VmRSS >= 85% of total system RAM',
      action: 'Emit HIGH_MEMORY alert (WARNING), track for potential crash',
      deduction: '-15 pts health score penalty'
    },
    {
      name: 'Deterministic Memory Growth Rule',
      condition: 'Monotonically increasing memory across >= 5 samples (+5% net increase)',
      action: 'Emit MEMORY_GROWTH alert (WARNING) flagging memory leak candidate',
      deduction: '-15 pts health score penalty'
    },
    {
      name: 'Process Crash & Auto-Restart Rule',
      condition: 'Configured PID no longer active in /proc or killed by signal',
      action: 'Emit PROCESS_CRASH (CRITICAL), execute fork/execvp restart if enabled',
      deduction: '-25 pts health score penalty'
    },
    {
      name: 'Restart Loop Protection Rule',
      condition: 'Exceeding 3 restarts within sliding 300-second window',
      action: 'Emit REPEATED_CRASH (CRITICAL), suspend auto-restart to prevent thrashing',
      deduction: '-30 pts health score penalty'
    },
    {
      name: 'Heartbeat Hang / Deadlock Rule',
      condition: 'Process PID alive but heartbeat file timestamp older than timeout (5s)',
      action: 'Emit PROCESS_HANG (CRITICAL), flag unresponsive worker threads',
      deduction: '-30 pts health score penalty'
    },
    {
      name: 'Filesystem Disk Saturation Rule',
      condition: 'POSIX statvfs root storage >= 85% (Warning) or >= 95% (Critical)',
      action: 'Emit DISK_WARNING / DISK_CRITICAL alert',
      deduction: '-10 to -25 pts health score penalty'
    }
  ];

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="cyber-card p-5">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <span>Watchdog Configuration & Deterministic Rules</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Zero-ML deterministic rule policies and fault-injection scenarios
        </p>
      </div>

      {/* Rules Grid */}
      <div className="cyber-card p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Active Deterministic Anomaly Rules</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((r, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-200 mb-2">
                <span>{r.name}</span>
                <span className="text-[10px] text-rose-400">{r.deduction}</span>
              </div>
              <div className="space-y-1.5 text-slate-400 text-[11px]">
                <p><strong className="text-slate-300">Condition:</strong> {r.condition}</p>
                <p><strong className="text-slate-300">Watchdog Action:</strong> {r.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Fault Injection Testing Guide */}
      <div className="cyber-card p-6">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
          <Play className="w-4 h-4 text-cyan-400" />
          <span>Local Fault Injection Test Execution Guide</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          You can run the compiled C++ test tools from the terminal to demonstrate live anomaly detection and recovery in this dashboard.
        </p>

        <div className="space-y-3 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-200 font-bold mb-1">
              <span>1. Induce CPU Saturation (HIGH_CPU)</span>
              <span className="text-cyan-400 text-[11px]">./tests/cpu_stress/cpu_stress</span>
            </div>
            <code className="block text-slate-400 bg-slate-900/90 p-2 rounded mt-1 font-mono">
              ./tests/cpu_stress/cpu_stress --threads 4 --duration 20
            </code>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-200 font-bold mb-1">
              <span>2. Induce Memory Growth (MEMORY_GROWTH)</span>
              <span className="text-purple-400 text-[11px]">./tests/memory_stress/memory_stress</span>
            </div>
            <code className="block text-slate-400 bg-slate-900/90 p-2 rounded mt-1 font-mono">
              ./tests/memory_stress/memory_stress --chunk-mb 50 --max-mb 600 --interval-ms 1000
            </code>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-200 font-bold mb-1">
              <span>3. Crash Monitored Service (PROCESS_CRASH & WATCHDOG_RESTART)</span>
              <span className="text-rose-400 text-[11px]">kill -9 &lt;PID&gt;</span>
            </div>
            <code className="block text-slate-400 bg-slate-900/90 p-2 rounded mt-1 font-mono">
              pkill -9 test_service
            </code>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-200 font-bold mb-1">
              <span>4. Simulate Service Deadlock / Hang (PROCESS_HANG)</span>
              <span className="text-amber-400 text-[11px]">./tests/hang_test/hang_service</span>
            </div>
            <code className="block text-slate-400 bg-slate-900/90 p-2 rounded mt-1 font-mono">
              ./tests/hang_test/hang_service --heartbeat /tmp/watchdog/test_service.heartbeat --live-sec 4
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
