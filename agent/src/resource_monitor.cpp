#include "resource_monitor.h"
#include "event.h"
#include <sys/statvfs.h>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <iostream>
#include <algorithm>

namespace watchdog {

std::string SystemMetrics::toJson() const {
    std::ostringstream ss;
    ss << "{"
       << "\"timestamp\":\"" << timestamp << "\","
       << "\"cpu_percent\":" << std::fixed << std::setprecision(2) << cpu_percent << ","
       << "\"memory_total_bytes\":" << memory_total_bytes << ","
       << "\"memory_used_bytes\":" << memory_used_bytes << ","
       << "\"memory_available_bytes\":" << memory_available_bytes << ","
       << "\"memory_percent\":" << std::fixed << std::setprecision(2) << memory_percent << ","
       << "\"disk_total_bytes\":" << disk_total_bytes << ","
       << "\"disk_used_bytes\":" << disk_used_bytes << ","
       << "\"disk_percent\":" << std::fixed << std::setprecision(2) << disk_percent << ","
       << "\"load_1m\":" << std::fixed << std::setprecision(2) << load_1m << ","
       << "\"load_5m\":" << std::fixed << std::setprecision(2) << load_5m << ","
       << "\"load_15m\":" << std::fixed << std::setprecision(2) << load_15m << ","
       << "\"net_rx_bytes\":" << net_rx_bytes << ","
       << "\"net_tx_bytes\":" << net_tx_bytes
       << "}";
    return ss.str();
}

ResourceMonitor::ResourceMonitor() {
    readCpuTimes(prev_cpu_idle_, prev_cpu_total_);
    SystemMetrics dummy;
    readMemInfo(dummy);
    total_ram_bytes_ = dummy.memory_total_bytes;
}

bool ResourceMonitor::readCpuTimes(uint64_t& idle_out, uint64_t& total_out) {
    std::ifstream file("/proc/stat");
    if (!file.is_open()) return false;

    std::string line;
    if (std::getline(file, line) && line.rfind("cpu ", 0) == 0) {
        std::istringstream iss(line.substr(4));
        uint64_t user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice;
        user = nice = system = idle = iowait = irq = softirq = steal = guest = guest_nice = 0;
        
        iss >> user >> nice >> system >> idle >> iowait >> irq >> softirq >> steal >> guest >> guest_nice;
        
        uint64_t idle_all = idle + iowait;
        uint64_t system_all = system + irq + softirq;
        uint64_t virt_all = guest + guest_nice;
        total_out = user + nice + system_all + idle_all + steal + virt_all;
        idle_out = idle_all;
        return true;
    }
    return false;
}

bool ResourceMonitor::readMemInfo(SystemMetrics& metrics) {
    std::ifstream file("/proc/meminfo");
    if (!file.is_open()) return false;

    std::string key;
    uint64_t val = 0;
    std::string unit;

    uint64_t mem_total_kb = 0;
    uint64_t mem_free_kb = 0;
    uint64_t mem_available_kb = 0;
    uint64_t buffers_kb = 0;
    uint64_t cached_kb = 0;

    while (file >> key >> val >> unit) {
        if (key == "MemTotal:") mem_total_kb = val;
        else if (key == "MemFree:") mem_free_kb = val;
        else if (key == "MemAvailable:") mem_available_kb = val;
        else if (key == "Buffers:") buffers_kb = val;
        else if (key == "Cached:") cached_kb = val;
    }

    metrics.memory_total_bytes = mem_total_kb * 1024;
    total_ram_bytes_ = metrics.memory_total_bytes;

    if (mem_available_kb > 0) {
        metrics.memory_available_bytes = mem_available_kb * 1024;
        metrics.memory_used_bytes = (mem_total_kb > mem_available_kb) ? (mem_total_kb - mem_available_kb) * 1024 : 0;
    } else {
        uint64_t used_kb = (mem_total_kb > (mem_free_kb + buffers_kb + cached_kb))
                           ? mem_total_kb - (mem_free_kb + buffers_kb + cached_kb)
                           : 0;
        metrics.memory_used_bytes = used_kb * 1024;
        metrics.memory_available_bytes = (mem_free_kb + buffers_kb + cached_kb) * 1024;
    }

    if (metrics.memory_total_bytes > 0) {
        metrics.memory_percent = (static_cast<double>(metrics.memory_used_bytes) / static_cast<double>(metrics.memory_total_bytes)) * 100.0;
        metrics.memory_percent = std::clamp(metrics.memory_percent, 0.0, 100.0);
    }

    return true;
}

bool ResourceMonitor::readLoadAvg(SystemMetrics& metrics) {
    std::ifstream file("/proc/loadavg");
    if (!file.is_open()) return false;

    file >> metrics.load_1m >> metrics.load_5m >> metrics.load_15m;
    return true;
}

bool ResourceMonitor::readDiskUsage(SystemMetrics& metrics) {
    struct statvfs stat;
    if (statvfs("/", &stat) != 0) {
        return false;
    }

    uint64_t block_size = stat.f_frsize;
    metrics.disk_total_bytes = stat.f_blocks * block_size;
    uint64_t disk_free_bytes = stat.f_bavail * block_size;
    metrics.disk_used_bytes = (metrics.disk_total_bytes > disk_free_bytes)
                              ? metrics.disk_total_bytes - disk_free_bytes
                              : 0;

    if (metrics.disk_total_bytes > 0) {
        metrics.disk_percent = (static_cast<double>(metrics.disk_used_bytes) / static_cast<double>(metrics.disk_total_bytes)) * 100.0;
        metrics.disk_percent = std::clamp(metrics.disk_percent, 0.0, 100.0);
    }
    return true;
}

bool ResourceMonitor::readNetworkDev(SystemMetrics& metrics) {
    std::ifstream file("/proc/net/dev");
    if (!file.is_open()) return false;

    std::string line;
    // Skip two header lines
    std::getline(file, line);
    std::getline(file, line);

    uint64_t total_rx = 0;
    uint64_t total_tx = 0;

    while (std::getline(file, line)) {
        auto colon = line.find(':');
        if (colon == std::string::npos) continue;

        std::string ifname = line.substr(0, colon);
        // Remove spaces
        ifname.erase(remove_if(ifname.begin(), ifname.end(), isspace), ifname.end());
        if (ifname == "lo") continue; // Ignore loopback

        std::istringstream iss(line.substr(colon + 1));
        uint64_t rx_bytes = 0, rx_pkts = 0, rx_errs = 0, rx_drop = 0, rx_fifo = 0, rx_frame = 0, rx_comp = 0, rx_mcast = 0;
        uint64_t tx_bytes = 0;

        if (iss >> rx_bytes >> rx_pkts >> rx_errs >> rx_drop >> rx_fifo >> rx_frame >> rx_comp >> rx_mcast >> tx_bytes) {
            total_rx += rx_bytes;
            total_tx += tx_bytes;
        }
    }

    metrics.net_rx_bytes = total_rx;
    metrics.net_tx_bytes = total_tx;
    return true;
}

SystemMetrics ResourceMonitor::collectMetrics() {
    SystemMetrics m;
    m.timestamp = getCurrentIsoTimestamp();

    // 1. CPU
    uint64_t curr_idle = 0, curr_total = 0;
    if (readCpuTimes(curr_idle, curr_total)) {
        uint64_t total_delta = curr_total > prev_cpu_total_ ? curr_total - prev_cpu_total_ : 0;
        uint64_t idle_delta = curr_idle > prev_cpu_idle_ ? curr_idle - prev_cpu_idle_ : 0;

        if (total_delta > 0) {
            double usage = 100.0 * (1.0 - (static_cast<double>(idle_delta) / static_cast<double>(total_delta)));
            m.cpu_percent = std::clamp(usage, 0.0, 100.0);
        }

        prev_cpu_idle_ = curr_idle;
        prev_cpu_total_ = curr_total;
    }

    // 2. Memory
    readMemInfo(m);

    // 3. Load
    readLoadAvg(m);

    // 4. Disk
    readDiskUsage(m);

    // 5. Network
    readNetworkDev(m);

    return m;
}

} // namespace watchdog
