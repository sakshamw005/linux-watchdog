#include "watchdog.h"
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <signal.h>
#include <iostream>
#include <iomanip>
#include <cstring>
#include <algorithm>

namespace watchdog {

WatchdogEngine::WatchdogEngine(const Config& config)
    : config_(config) {
    http_client_ = std::make_unique<HttpClient>(config_.api_url);

    for (const auto& p_cfg : config_.processes) {
        MonitoredProcessState state;
        state.config = p_cfg;
        monitored_states_.push_back(state);
    }
}

WatchdogEngine::~WatchdogEngine() {
    shutdown();
}

void WatchdogEngine::initialize() {
    std::cout << "[INFO] Initializing Watchdog Engine with " << monitored_states_.size() 
              << " monitored processes." << std::endl;

    Event start_event;
    start_event.timestamp = getCurrentIsoTimestamp();
    start_event.event_type = EventType::AGENT_STARTED;
    start_event.severity = Severity::INFO;
    start_event.message = "Embedded Linux Watchdog Agent started.";
    dispatchEvent(start_event);

    // Initial process scan
    auto procs = process_monitor_.scanProcesses(resource_monitor_.getTotalRamBytes());

    for (auto& state : monitored_states_) {
        int existing_pid = findPidByName(state.config.name, procs);
        if (existing_pid > 0) {
            state.current_pid = existing_pid;
            state.is_running = true;
            std::cout << "[INFO] Attached to existing process '" << state.config.name 
                      << "' (PID: " << existing_pid << ")" << std::endl;
        } else if (state.config.restart_enabled) {
            std::cout << "[INFO] Process '" << state.config.name << "' is not running. Spawning initial instance..." << std::endl;
            int new_pid = spawnProcess(state.config);
            if (new_pid > 0) {
                state.current_pid = new_pid;
                state.is_running = true;
                std::cout << "[INFO] Successfully spawned '" << state.config.name << "' (PID: " << new_pid << ")" << std::endl;

                WatchdogAction act;
                act.timestamp = getCurrentIsoTimestamp();
                act.pid = new_pid;
                act.process_name = state.config.name;
                act.action = "SPAWN";
                act.result = "SUCCESS";
                act.message = "Initial process spawn.";
                dispatchAction(act);
            }
        }
    }
}

int WatchdogEngine::findPidByName(const std::string& name, const std::vector<ProcessInfo>& all_procs) {
    for (const auto& p : all_procs) {
        if (p.name == name || p.cmdline.find(name) != std::string::npos) {
            return p.pid;
        }
    }
    return -1;
}

int WatchdogEngine::spawnProcess(const ProcessConfig& p_cfg) {
    // Create directory for heartbeat if needed
    if (!p_cfg.heartbeat_file.empty()) {
        auto last_slash = p_cfg.heartbeat_file.rfind('/');
        if (last_slash != std::string::npos) {
            std::string dir = p_cfg.heartbeat_file.substr(0, last_slash);
            mkdir(dir.c_str(), 0755);
        }
    }

    pid_t pid = fork();
    if (pid < 0) {
        std::cerr << "[ERROR] Failed to fork process for '" << p_cfg.name << "': " << strerror(errno) << std::endl;
        return -1;
    }

    if (pid == 0) {
        // Child process
        std::vector<char*> argv;
        argv.push_back(const_cast<char*>(p_cfg.command.c_str()));
        for (const auto& arg : p_cfg.args) {
            argv.push_back(const_cast<char*>(arg.c_str()));
        }
        argv.push_back(nullptr);

        execvp(p_cfg.command.c_str(), argv.data());

        // If execvp returns, it failed
        std::cerr << "[ERROR] execvp failed for '" << p_cfg.command << "': " << strerror(errno) << std::endl;
        _exit(127);
    }

    // Parent process: give child a moment to start
    usleep(50000); // 50ms
    int status = 0;
    pid_t res = waitpid(pid, &status, WNOHANG);
    if (res == pid) {
        std::cerr << "[ERROR] Process '" << p_cfg.name << "' exited immediately with status " << status << std::endl;
        return -1;
    }

    return static_cast<int>(pid);
}

bool WatchdogEngine::manualRestart(int pid) {
    for (auto& state : monitored_states_) {
        if (state.current_pid == pid || (pid <= 0 && !state.config.name.empty())) {
            std::cout << "[INFO] Manual restart requested for '" << state.config.name 
                      << "' (PID: " << state.current_pid << ")" << std::endl;
            if (state.current_pid > 0) {
                kill(state.current_pid, SIGTERM);
                usleep(100000);
                kill(state.current_pid, SIGKILL);
            }
            state.restart_disabled = false; // Reset restart limits on manual trigger
            restartProcess(state);
            return true;
        }
    }
    return false;
}

void WatchdogEngine::restartProcess(MonitoredProcessState& state) {
    time_t now = time(nullptr);

    // Filter out timestamps outside restart window
    while (!state.restart_timestamps.empty() && 
           (now - state.restart_timestamps.front()) > state.config.restart_window_seconds) {
        state.restart_timestamps.pop_front();
    }

    // Enforce restart loop protection
    if (static_cast<int>(state.restart_timestamps.size()) >= state.config.max_restarts) {
        state.restart_disabled = true;
        std::cerr << "[CRITICAL] Restart limit reached for '" << state.config.name 
                  << "' (" << state.config.max_restarts << " restarts in " 
                  << state.config.restart_window_seconds << "s). Automatic restart DISABLED." << std::endl;

        Event rep_event;
        rep_event.timestamp = getCurrentIsoTimestamp();
        rep_event.pid = state.current_pid;
        rep_event.process_name = state.config.name;
        rep_event.event_type = EventType::REPEATED_CRASH;
        rep_event.severity = Severity::CRITICAL;
        rep_event.message = "Automatic restart disabled because restart limit was exceeded.";
        rep_event.diagnosis = "Application instability detected (frequent crashes).";
        dispatchEvent(rep_event);

        WatchdogAction act;
        act.timestamp = getCurrentIsoTimestamp();
        act.pid = state.current_pid;
        act.process_name = state.config.name;
        act.action = "DISABLED_RESTART";
        act.result = "LIMIT_EXCEEDED";
        act.message = "Restart limit exceeded.";
        dispatchAction(act);
        return;
    }

    std::cout << "[INFO] Restarting process '" << state.config.name << "'..." << std::endl;
    int new_pid = spawnProcess(state.config);
    if (new_pid > 0) {
        state.current_pid = new_pid;
        state.is_running = true;
        state.was_crashed = false;
        state.was_hanging = false;
        state.total_restarts++;
        state.restart_timestamps.push_back(now);
        state.recent_memory_percent.clear();
        state.recent_cpu_percent.clear();

        std::cout << "[INFO] Process '" << state.config.name << "' restarted successfully with new PID: " 
                  << new_pid << " (Total restarts: " << state.total_restarts << ")" << std::endl;

        Event restart_ev;
        restart_ev.timestamp = getCurrentIsoTimestamp();
        restart_ev.pid = new_pid;
        restart_ev.process_name = state.config.name;
        restart_ev.event_type = EventType::WATCHDOG_RESTART;
        restart_ev.severity = Severity::INFO;
        restart_ev.message = "Watchdog automatically restarted the process.";
        dispatchEvent(restart_ev);

        WatchdogAction act;
        act.timestamp = getCurrentIsoTimestamp();
        act.pid = new_pid;
        act.process_name = state.config.name;
        act.action = "RESTART";
        act.result = "SUCCESS";
        act.message = "Automatic watchdog restart.";
        dispatchAction(act);
    } else {
        std::cerr << "[ERROR] Failed to restart process '" << state.config.name << "'" << std::endl;
        WatchdogAction act;
        act.timestamp = getCurrentIsoTimestamp();
        act.pid = 0;
        act.process_name = state.config.name;
        act.action = "RESTART";
        act.result = "FAILED";
        act.message = "Process spawn failed.";
        dispatchAction(act);
    }
}

void WatchdogEngine::handleProcessCrash(MonitoredProcessState& state) {
    std::cerr << "[CRITICAL] Process '" << state.config.name << "' (PID: " 
              << state.current_pid << ") CRASHED or disappeared!" << std::endl;

    state.is_running = false;
    state.was_crashed = true;

    Event crash_ev;
    crash_ev.timestamp = getCurrentIsoTimestamp();
    crash_ev.pid = state.current_pid;
    crash_ev.process_name = state.config.name;
    crash_ev.event_type = EventType::PROCESS_CRASH;
    crash_ev.severity = Severity::CRITICAL;
    crash_ev.message = "Monitored process terminated unexpectedly.";

    // Check if preceded by high memory
    if (!state.recent_memory_percent.empty() && state.recent_memory_percent.back() >= 75.0) {
        crash_ev.diagnosis = "Possible memory exhaustion preceding process termination.";
    } else {
        crash_ev.diagnosis = "Process vanished from /proc or exited abnormally.";
    }

    dispatchEvent(crash_ev);

    if (state.config.restart_enabled && !state.restart_disabled) {
        restartProcess(state);
    }
}

void WatchdogEngine::checkProcessExistence(MonitoredProcessState& state, const std::vector<ProcessInfo>& all_procs) {
    if (state.current_pid <= 0) {
        // If not running and auto-restart enabled, try spawning
        if (state.config.restart_enabled && !state.restart_disabled) {
            restartProcess(state);
        }
        return;
    }

    // Check if PID exists in /proc
    bool exists = false;
    for (const auto& p : all_procs) {
        if (p.pid == state.current_pid) {
            exists = true;
            break;
        }
    }

    // Verify with kill(pid, 0)
    if (!exists || (kill(state.current_pid, 0) != 0 && errno == ESRCH)) {
        // Reap zombie if present
        int status;
        waitpid(state.current_pid, &status, WNOHANG);
        handleProcessCrash(state);
    } else {
        state.is_running = true;
    }
}

void WatchdogEngine::checkHeartbeat(MonitoredProcessState& state) {
    if (state.config.heartbeat_file.empty() || !state.is_running || state.current_pid <= 0) {
        return;
    }

    struct stat st;
    if (stat(state.config.heartbeat_file.c_str(), &st) != 0) {
        return; // File not created yet
    }

    time_t now = time(nullptr);
    double elapsed = difftime(now, st.st_mtime);

    if (elapsed > state.config.heartbeat_timeout_seconds) {
        if (!state.was_hanging || (now - state.last_hang_alert_time) >= 15) {
            std::cerr << "[CRITICAL] Process '" << state.config.name << "' (PID: " << state.current_pid 
                      << ") HEARTBEAT TIMEOUT! (" << elapsed << "s > " 
                      << state.config.heartbeat_timeout_seconds << "s)" << std::endl;

            state.was_hanging = true;
            state.last_hang_alert_time = now;

            Event hang_ev;
            hang_ev.timestamp = getCurrentIsoTimestamp();
            hang_ev.pid = state.current_pid;
            hang_ev.process_name = state.config.name;
            hang_ev.event_type = EventType::PROCESS_HANG;
            hang_ev.severity = Severity::CRITICAL;
            hang_ev.value = elapsed;
            hang_ev.threshold = state.config.heartbeat_timeout_seconds;
            hang_ev.message = "Process heartbeat stopped updating. Application may be hung or deadlocked.";
            hang_ev.diagnosis = "Application may be unresponsive or blocked.";
            dispatchEvent(hang_ev);
        }
    } else {
        if (state.was_hanging) {
            state.was_hanging = false;
            std::cout << "[INFO] Process '" << state.config.name << "' heartbeat resumed." << std::endl;
            Event rec_ev;
            rec_ev.timestamp = getCurrentIsoTimestamp();
            rec_ev.pid = state.current_pid;
            rec_ev.process_name = state.config.name;
            rec_ev.event_type = EventType::PROCESS_RECOVERED;
            rec_ev.severity = Severity::INFO;
            rec_ev.message = "Process heartbeat resumed normal operation.";
            dispatchEvent(rec_ev);
        }
    }
}

bool WatchdogEngine::shouldEmitAlert(MonitoredProcessState& state, const std::string& alert_key, int cooldown_seconds) {
    auto now = std::chrono::steady_clock::now();
    auto it = state.alert_cooldowns.find(alert_key);
    if (it == state.alert_cooldowns.end() ||
        std::chrono::duration_cast<std::chrono::seconds>(now - it->second).count() >= cooldown_seconds) {
        state.alert_cooldowns[alert_key] = now;
        return true;
    }
    return false;
}

bool WatchdogEngine::shouldEmitSystemAlert(const std::string& alert_key, int cooldown_seconds) {
    auto now = std::chrono::steady_clock::now();
    auto it = system_alert_cooldowns_.find(alert_key);
    if (it == system_alert_cooldowns_.end() ||
        std::chrono::duration_cast<std::chrono::seconds>(now - it->second).count() >= cooldown_seconds) {
        system_alert_cooldowns_[alert_key] = now;
        return true;
    }
    return false;
}

void WatchdogEngine::evaluateProcessRules(MonitoredProcessState& state, const ProcessInfo& info) {
    // 1. High CPU Rule
    state.recent_cpu_percent.push_back(info.cpu_percent);
    if (state.recent_cpu_percent.size() > 10) state.recent_cpu_percent.pop_front();

    if (info.cpu_percent >= state.config.max_cpu_percent) {
        if (shouldEmitAlert(state, "HIGH_CPU", 20)) {
            std::cout << "[WARNING] High CPU for '" << state.config.name << "' (" 
                      << info.cpu_percent << "% >= " << state.config.max_cpu_percent << "%)" << std::endl;

            Event ev;
            ev.timestamp = getCurrentIsoTimestamp();
            ev.pid = info.pid;
            ev.process_name = state.config.name;
            ev.event_type = EventType::HIGH_CPU;
            ev.severity = Severity::WARNING;
            ev.value = info.cpu_percent;
            ev.threshold = state.config.max_cpu_percent;
            ev.message = "Process CPU usage exceeded configured threshold.";
            ev.diagnosis = "CPU saturation detected.";
            dispatchEvent(ev);
        }
    }

    // 2. High Memory Rule
    state.recent_memory_percent.push_back(info.memory_percent);
    if (state.recent_memory_percent.size() > 8) state.recent_memory_percent.pop_front();

    if (info.memory_percent >= state.config.max_memory_percent) {
        if (shouldEmitAlert(state, "HIGH_MEMORY", 20)) {
            std::cout << "[WARNING] High Memory for '" << state.config.name << "' (" 
                      << info.memory_percent << "% >= " << state.config.max_memory_percent << "%)" << std::endl;

            Event ev;
            ev.timestamp = getCurrentIsoTimestamp();
            ev.pid = info.pid;
            ev.process_name = state.config.name;
            ev.event_type = EventType::HIGH_MEMORY;
            ev.severity = Severity::WARNING;
            ev.value = info.memory_percent;
            ev.threshold = state.config.max_memory_percent;
            ev.message = "Process memory usage exceeded configured threshold.";
            ev.diagnosis = "High memory consumption detected.";
            dispatchEvent(ev);
        }
    }

    // 3. Memory Growth (Strictly increasing slope over >= 5 samples)
    if (state.recent_memory_percent.size() >= 5) {
        bool strictly_increasing = true;
        for (size_t i = 1; i < state.recent_memory_percent.size(); ++i) {
            if (state.recent_memory_percent[i] < state.recent_memory_percent[i - 1]) {
                strictly_increasing = false;
                break;
            }
        }
        double total_growth = state.recent_memory_percent.back() - state.recent_memory_percent.front();
        if (strictly_increasing && total_growth >= 4.0) { // at least 4% monotonic growth
            if (shouldEmitAlert(state, "MEMORY_GROWTH", 30)) {
                std::cout << "[WARNING] Memory growth detected for '" << state.config.name 
                          << "' (growth: +" << total_growth << "% across samples)" << std::endl;

                Event ev;
                ev.timestamp = getCurrentIsoTimestamp();
                ev.pid = info.pid;
                ev.process_name = state.config.name;
                ev.event_type = EventType::MEMORY_GROWTH;
                ev.severity = Severity::WARNING;
                ev.value = state.recent_memory_percent.back();
                ev.threshold = total_growth;
                ev.message = "Continuous memory growth observed across multiple sampling intervals.";
                ev.diagnosis = "Possible memory leak or abnormal memory consumption.";
                dispatchEvent(ev);
            }
        }
    }
}

void WatchdogEngine::evaluateSystemRules(const SystemMetrics& sys_metrics) {
    if (sys_metrics.disk_percent >= config_.disk_critical_percent) {
        if (shouldEmitSystemAlert("DISK_CRITICAL", 60)) {
            Event ev;
            ev.timestamp = getCurrentIsoTimestamp();
            ev.process_name = "SYSTEM";
            ev.event_type = EventType::DISK_CRITICAL;
            ev.severity = Severity::CRITICAL;
            ev.value = sys_metrics.disk_percent;
            ev.threshold = config_.disk_critical_percent;
            ev.message = "Root filesystem disk usage reached critical threshold.";
            ev.diagnosis = "Disk space nearly exhausted.";
            dispatchEvent(ev);
        }
    } else if (sys_metrics.disk_percent >= config_.disk_warning_percent) {
        if (shouldEmitSystemAlert("DISK_WARNING", 60)) {
            Event ev;
            ev.timestamp = getCurrentIsoTimestamp();
            ev.process_name = "SYSTEM";
            ev.event_type = EventType::DISK_WARNING;
            ev.severity = Severity::WARNING;
            ev.value = sys_metrics.disk_percent;
            ev.threshold = config_.disk_warning_percent;
            ev.message = "Root filesystem disk usage exceeded warning threshold.";
            ev.diagnosis = "Disk space running low.";
            dispatchEvent(ev);
        }
    }
}

void WatchdogEngine::dispatchEvent(const Event& event) {
    std::string json = event.toJson();
    http_client_->postJson("/api/agent/events", json);
}

void WatchdogEngine::dispatchAction(const WatchdogAction& action) {
    std::string json = action.toJson();
    http_client_->postJson("/api/agent/actions", json);
}

void WatchdogEngine::runCycle() {
    uint64_t total_ram = resource_monitor_.getTotalRamBytes();
    SystemMetrics sys_metrics = resource_monitor_.collectMetrics();
    evaluateSystemRules(sys_metrics);

    auto all_procs = process_monitor_.scanProcesses(total_ram);

    std::vector<ProcessInfo> monitored_infos;

    // Check each monitored process
    for (auto& state : monitored_states_) {
        checkProcessExistence(state, all_procs);
        checkHeartbeat(state);

        if (state.is_running && state.current_pid > 0) {
            ProcessInfo pinfo;
            if (process_monitor_.getProcessInfo(state.current_pid, total_ram, pinfo)) {
                evaluateProcessRules(state, pinfo);
                monitored_infos.push_back(pinfo);
            }
        }
    }

    // Format metrics ingestion payload
    std::ostringstream ss;
    ss << "{"
       << "\"system\":" << sys_metrics.toJson() << ","
       << "\"monitored_processes\":[";
    for (size_t i = 0; i < monitored_infos.size(); ++i) {
        if (i > 0) ss << ",";
        ss << monitored_infos[i].toJson();
    }
    ss << "],\"all_processes\":[";

    // Include top 30 active processes
    std::vector<ProcessInfo> top_procs = all_procs;
    std::sort(top_procs.begin(), top_procs.end(), [](const ProcessInfo& a, const ProcessInfo& b) {
        return (a.cpu_percent + a.memory_percent) > (b.cpu_percent + b.memory_percent);
    });

    size_t count = std::min<size_t>(top_procs.size(), 30);
    for (size_t i = 0; i < count; ++i) {
        if (i > 0) ss << ",";
        ss << top_procs[i].toJson();
    }
    ss << "]}";

    http_client_->postJson("/api/agent/metrics", ss.str());
}

void WatchdogEngine::shutdown() {
    std::cout << "[INFO] Shutting down Watchdog Engine. Cleaning up managed processes..." << std::endl;
    for (auto& state : monitored_states_) {
        if (state.is_running && state.current_pid > 0) {
            std::cout << "[INFO] Terminating managed process '" << state.config.name 
                      << "' (PID: " << state.current_pid << ")..." << std::endl;
            kill(state.current_pid, SIGTERM);
            usleep(100000);
            kill(state.current_pid, SIGKILL);
            int st;
            waitpid(state.current_pid, &st, WNOHANG);
            state.is_running = false;
        }
    }
}

} // namespace watchdog
