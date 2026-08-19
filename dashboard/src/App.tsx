import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { 
  SystemMetrics, 
  ProcessInfo, 
  EventItem, 
  WatchdogStatus, 
  HealthResponse 
} from './types';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { ProcessesPage } from './pages/ProcessesPage';
import { AlertsPage } from './pages/AlertsPage';
import { IncidentTimelinePage } from './pages/IncidentTimelinePage';
import { SettingsPage } from './pages/SettingsPage';
import { ProcessDetailModal } from './components/ProcessDetailModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [system, setSystem] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<SystemMetrics[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [status, setStatus] = useState<WatchdogStatus | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTelemetry = useCallback(async () => {
    try {
      const [healthData, sysData, histData, procData, eventData, statData] = await Promise.allSettled([
        api.getHealth(),
        api.getSystem(),
        api.getSystemMetricsHistory(40),
        api.getProcesses(),
        api.getEvents({ limit: 40 }),
        api.getWatchdogStatus(),
      ]);

      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (sysData.status === 'fulfilled') setSystem(sysData.value);
      if (histData.status === 'fulfilled') setHistory(histData.value);
      if (procData.status === 'fulfilled') setProcesses(procData.value);
      if (eventData.status === 'fulfilled') setEvents(eventData.value);
      if (statData.status === 'fulfilled') setStatus(statData.value);
    } catch (err) {
      console.error('Telemetry refresh error', err);
    }
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchTelemetry();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2500); // 2.5s polling loop
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const handleRestartProcess = async (pid: number) => {
    if (!confirm(`Confirm manual restart for PID ${pid}?`)) return;
    try {
      await api.restartProcess(pid);
      fetchTelemetry();
    } catch (err: any) {
      alert(`Restart failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans">
      {/* Top SOC Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        status={status}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewPage
            system={system}
            history={history}
            health={health}
            status={status}
            events={events}
            onSelectProcess={(pid) => setSelectedPid(pid)}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'processes' && (
          <ProcessesPage
            processes={processes}
            onSelectProcess={(pid) => setSelectedPid(pid)}
            onRestartProcess={handleRestartProcess}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsPage
            events={events}
            onSelectProcess={(pid) => setSelectedPid(pid)}
          />
        )}

        {activeTab === 'incidents' && (
          <IncidentTimelinePage />
        )}

        {activeTab === 'settings' && (
          <SettingsPage status={status} />
        )}
      </main>

      {/* Process Deep Dive Modal */}
      <ProcessDetailModal
        pid={selectedPid}
        onClose={() => setSelectedPid(null)}
        onRestartSuccess={fetchTelemetry}
      />

    </div>
  );
};
export default App;
