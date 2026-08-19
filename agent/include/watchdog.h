#pragma once

#include "config.h"
#include "event.h"
#include "process_monitor.h"
#include "resource_monitor.h"
#include "http_client.h"

#include <vector>
#include <deque>
#include <unordered_map>
#include <chrono>
#include <memory>

namespace watchdog {

struct MonitoredProcessState {
    ProcessConfig config;
    int current_pid{-1};
    bool is_running{false};
    int total_restarts{0};
    std::deque<time_t> restart_timestamps;
    bool restart_disabled{false};
    std::deque<double> recent_memory_percent;
    std::deque<double> recent_cpu_percent;
    std::unordered_map<std::string, std::chrono::steady_clock::time_point> alert_cooldowns;
    bool was_crashed{false};
    bool was_hanging{false};
    time_t last_hang_alert_time{0};
};

class WatchdogEngine {
public:
    WatchdogEngine(const Config& config);
    ~WatchdogEngine();

    // Initialize monitored processes (spawn or attach)
    void initialize();

    // Single step iteration of watchdog monitoring loop
    void runCycle();

    // Gracefully stop all managed processes
    void shutdown();

    // Trigger manual restart by PID or name
    bool manualRestart(int pid);

private:
    Config config_;
    ProcessMonitor process_monitor_;
    ResourceMonitor resource_monitor_;
    std::unique_ptr<HttpClient> http_client_;
    std::vector<MonitoredProcessState> monitored_states_;
    std::unordered_map<std::string, std::chrono::steady_clock::time_point> system_alert_cooldowns_;

    // Process lifecycle
    int spawnProcess(const ProcessConfig& p_cfg);
    void checkProcessExistence(MonitoredProcessState& state, const std::vector<ProcessInfo>& all_procs);
    void evaluateProcessRules(MonitoredProcessState& state, const ProcessInfo& info);
    void evaluateSystemRules(const SystemMetrics& sys_metrics);
    void checkHeartbeat(MonitoredProcessState& state);
    void handleProcessCrash(MonitoredProcessState& state);
    void restartProcess(MonitoredProcessState& state);

    // Event & deduplication helpers
    bool shouldEmitAlert(MonitoredProcessState& state, const std::string& alert_key, int cooldown_seconds = 20);
    bool shouldEmitSystemAlert(const std::string& alert_key, int cooldown_seconds = 30);
    void dispatchEvent(const Event& event);
    void dispatchAction(const WatchdogAction& action);

    // Find PID by process name among running processes
    int findPidByName(const std::string& name, const std::vector<ProcessInfo>& all_procs);
};

} // namespace watchdog
