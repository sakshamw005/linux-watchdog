#pragma once

#include <string>
#include <vector>

namespace watchdog {

struct ProcessConfig {
    std::string name;
    std::string command;
    std::vector<std::string> args;
    bool restart_enabled{true};
    double max_cpu_percent{90.0};
    double max_memory_percent{85.0};
    int max_restarts{3};
    int restart_window_seconds{300};
    std::string heartbeat_file;
    int heartbeat_timeout_seconds{10};
};

struct Config {
    int monitor_interval_seconds{2};
    std::string api_url{"http://127.0.0.1:8000"};
    double disk_warning_percent{85.0};
    double disk_critical_percent{95.0};
    std::vector<ProcessConfig> processes;

    static Config loadFromFile(const std::string& filepath);
    static Config getDefault();
};

} // namespace watchdog
