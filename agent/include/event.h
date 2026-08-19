#pragma once

#include <string>
#include <chrono>
#include <sstream>
#include <iomanip>

namespace watchdog {

enum class EventType {
    HIGH_CPU,
    HIGH_MEMORY,
    MEMORY_GROWTH,
    DISK_WARNING,
    DISK_CRITICAL,
    PROCESS_CRASH,
    PROCESS_HANG,
    WATCHDOG_RESTART,
    REPEATED_CRASH,
    PROCESS_RECOVERED,
    AGENT_STARTED
};

enum class Severity {
    INFO,
    WARNING,
    CRITICAL
};

inline std::string eventTypeToString(EventType type) {
    switch (type) {
        case EventType::HIGH_CPU: return "HIGH_CPU";
        case EventType::HIGH_MEMORY: return "HIGH_MEMORY";
        case EventType::MEMORY_GROWTH: return "MEMORY_GROWTH";
        case EventType::DISK_WARNING: return "DISK_WARNING";
        case EventType::DISK_CRITICAL: return "DISK_CRITICAL";
        case EventType::PROCESS_CRASH: return "PROCESS_CRASH";
        case EventType::PROCESS_HANG: return "PROCESS_HANG";
        case EventType::WATCHDOG_RESTART: return "WATCHDOG_RESTART";
        case EventType::REPEATED_CRASH: return "REPEATED_CRASH";
        case EventType::PROCESS_RECOVERED: return "PROCESS_RECOVERED";
        case EventType::AGENT_STARTED: return "AGENT_STARTED";
        default: return "UNKNOWN";
    }
}

inline std::string severityToString(Severity sev) {
    switch (sev) {
        case Severity::INFO: return "INFO";
        case Severity::WARNING: return "WARNING";
        case Severity::CRITICAL: return "CRITICAL";
        default: return "INFO";
    }
}

inline std::string getCurrentIsoTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
    
    std::stringstream ss;
    struct tm tm_buf;
    gmtime_r(&in_time_t, &tm_buf);
    ss << std::put_time(&tm_buf, "%Y-%m-%dT%H:%M:%S") << "."
       << std::setfill('0') << std::setw(3) << ms.count() << "Z";
    return ss.str();
}

struct Event {
    std::string timestamp;
    int pid{0};
    std::string process_name;
    EventType event_type{EventType::AGENT_STARTED};
    Severity severity{Severity::INFO};
    double value{0.0};
    double threshold{0.0};
    std::string message;
    std::string diagnosis;

    std::string toJson() const;
};

struct WatchdogAction {
    std::string timestamp;
    int pid{0};
    std::string process_name;
    std::string action; // "RESTART", "DISABLED_RESTART", "SPAWN"
    std::string result; // "SUCCESS", "FAILED"
    std::string message;

    std::string toJson() const;
};

} // namespace watchdog
