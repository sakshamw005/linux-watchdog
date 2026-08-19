#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <cstdint>

namespace watchdog {

struct ProcessInfo {
    int pid{0};
    std::string name;
    std::string state{"UNKNOWN"}; // "R", "S", "D", "Z", "T", etc.
    int ppid{0};
    double cpu_percent{0.0};
    uint64_t memory_bytes{0}; // VmRSS in bytes
    uint64_t vm_size_bytes{0}; // VmSize in bytes
    double memory_percent{0.0};
    int thread_count{1};
    uint64_t start_time_ticks{0};
    double uptime_seconds{0.0};
    std::string cmdline;

    std::string toJson() const;
};

struct ProcessSample {
    uint64_t utime{0};
    uint64_t stime{0};
    uint64_t total_system_ticks{0};
    uint64_t timestamp_ms{0};
};

class ProcessMonitor {
public:
    ProcessMonitor();
    ~ProcessMonitor() = default;

    // Refresh all process metrics and return active processes
    std::vector<ProcessInfo> scanProcesses(uint64_t total_ram_bytes);

    // Get specific process info by PID
    bool getProcessInfo(int pid, uint64_t total_ram_bytes, ProcessInfo& out_info);

    // Helper to read total CPU ticks from /proc/stat
    static uint64_t readTotalSystemCpuTicks();

    // Helper to get system uptime in seconds from /proc/uptime
    static double getSystemUptimeSeconds();

    // Helper to get clock ticks per second (e.g. 100)
    static long getClockTicksPerSecond();

    // Number of online CPU cores
    static int getCpuCoreCount();

private:
    std::unordered_map<int, ProcessSample> prev_samples_;
    uint64_t prev_system_total_ticks_{0};
    long clk_tck_{100};
    int num_cores_{1};

    bool parseStatFile(int pid, ProcessInfo& info, uint64_t& out_utime, uint64_t& out_stime);
    bool parseStatusFile(int pid, ProcessInfo& info);
    bool parseCmdlineFile(int pid, ProcessInfo& info);
};

} // namespace watchdog
