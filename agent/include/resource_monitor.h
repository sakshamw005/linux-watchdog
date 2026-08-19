#pragma once

#include <string>
#include <cstdint>

namespace watchdog {

struct SystemMetrics {
    double cpu_percent{0.0};
    uint64_t memory_total_bytes{0};
    uint64_t memory_used_bytes{0};
    uint64_t memory_available_bytes{0};
    double memory_percent{0.0};
    uint64_t disk_total_bytes{0};
    uint64_t disk_used_bytes{0};
    double disk_percent{0.0};
    double load_1m{0.0};
    double load_5m{0.0};
    double load_15m{0.0};
    uint64_t net_rx_bytes{0};
    uint64_t net_tx_bytes{0};
    std::string timestamp;

    std::string toJson() const;
};

class ResourceMonitor {
public:
    ResourceMonitor();
    ~ResourceMonitor() = default;

    // Collect latest system resource metrics
    SystemMetrics collectMetrics();

    // Direct helper to get total RAM in bytes
    uint64_t getTotalRamBytes() const { return total_ram_bytes_; }

private:
    uint64_t prev_cpu_idle_{0};
    uint64_t prev_cpu_total_{0};
    uint64_t total_ram_bytes_{0};

    bool readCpuTimes(uint64_t& idle_out, uint64_t& total_out);
    bool readMemInfo(SystemMetrics& metrics);
    bool readLoadAvg(SystemMetrics& metrics);
    bool readDiskUsage(SystemMetrics& metrics);
    bool readNetworkDev(SystemMetrics& metrics);
};

} // namespace watchdog
