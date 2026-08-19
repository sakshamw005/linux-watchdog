import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  Bell, 
  GitCommit, 
  Sliders, 
  RefreshCw,
  Server
} from 'lucide-react';
import { HealthResponse, WatchdogStatus } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  health: HealthResponse | null;
  status: WatchdogStatus | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  health,
  status,
  onRefresh,
  isRefreshing
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'processes', label: 'Processes', icon: Cpu },
    { id: 'alerts', label: 'Alerts & Diagnostics', icon: Bell, badge: status?.active_alerts },
    { id: 'incidents', label: 'Incident Timelines', icon: GitCommit },
    { id: 'settings', label: 'Watchdog Rules', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">EMBEDDED LINUX</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  WATCHDOG
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">POSIX /proc Monitor & Recovery Agent</p>
            </div>
          </div>

          {/* Center Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs font-mono font-bold bg-rose-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Live Status Badges */}
          <div className="flex items-center space-x-4">
            {/* Health Score Pill */}
            {health && (
              <div className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                health.score >= 70
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                  : health.score >= 40
                  ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                  : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
              }`}>
                {health.score >= 70 ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                <span>Health: {health.score}/100</span>
              </div>
            )}

            {/* Agent Connection Indicator */}
            <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${status?.agent_connected ? 'bg-emerald-400 pulse-emerald' : 'bg-rose-500'}`} />
              <span className="text-slate-300">{status?.agent_connected ? 'AGENT ONLINE' : 'AGENT OFFLINE'}</span>
            </div>

            {/* Live Clock */}
            <div className="hidden lg:block text-xs font-mono text-slate-400">
              {timeStr}
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation tab strip */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 border-t border-slate-800 space-x-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
              activeTab === item.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
