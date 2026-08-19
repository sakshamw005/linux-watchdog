#include "config.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <regex>

namespace watchdog {

Config Config::getDefault() {
    Config cfg;
    cfg.monitor_interval_seconds = 2;
    cfg.api_url = "http://127.0.0.1:8000";
    cfg.disk_warning_percent = 85.0;
    cfg.disk_critical_percent = 95.0;
    return cfg;
}

Config Config::loadFromFile(const std::string& filepath) {
    Config cfg = getDefault();
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "[WARNING] Unable to open config file: " << filepath << ". Using defaults." << std::endl;
        return cfg;
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();

    // Parse top-level keys
    std::smatch match;
    if (std::regex_search(content, match, std::regex(R"raw("monitor_interval_seconds"\s*:\s*(\d+))raw"))) {
        cfg.monitor_interval_seconds = std::stoi(match[1]);
    }
    if (std::regex_search(content, match, std::regex(R"raw("api_url"\s*:\s*"([^"]+)")raw"))) {
        cfg.api_url = match[1];
    }
    if (std::regex_search(content, match, std::regex(R"raw("disk_warning_percent"\s*:\s*([\d.]+))raw"))) {
        cfg.disk_warning_percent = std::stod(match[1]);
    }
    if (std::regex_search(content, match, std::regex(R"raw("disk_critical_percent"\s*:\s*([\d.]+))raw"))) {
        cfg.disk_critical_percent = std::stod(match[1]);
    }

    // Parse processes array
    auto proc_start = content.find("\"processes\"");
    if (proc_start != std::string::npos) {
        auto array_start = content.find('[', proc_start);
        auto array_end = content.rfind(']');
        if (array_start != std::string::npos && array_end != std::string::npos && array_end > array_start) {
            std::string proc_str = content.substr(array_start + 1, array_end - array_start - 1);
            
            // Match individual objects {...}
            std::regex obj_regex(R"raw(\{([^}]+)\})raw");
            auto obj_begin = std::sregex_iterator(proc_str.begin(), proc_str.end(), obj_regex);
            auto obj_end = std::sregex_iterator();

            for (auto i = obj_begin; i != obj_end; ++i) {
                std::string item_content = (*i)[1].str();
                ProcessConfig p;
                
                if (std::regex_search(item_content, match, std::regex(R"raw("name"\s*:\s*"([^"]+)")raw"))) {
                    p.name = match[1];
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("command"\s*:\s*"([^"]+)")raw"))) {
                    p.command = match[1];
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("restart_enabled"\s*:\s*(true|false))raw"))) {
                    p.restart_enabled = (match[1] == "true");
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("max_cpu_percent"\s*:\s*([\d.]+))raw"))) {
                    p.max_cpu_percent = std::stod(match[1]);
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("max_memory_percent"\s*:\s*([\d.]+))raw"))) {
                    p.max_memory_percent = std::stod(match[1]);
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("max_restarts"\s*:\s*(\d+))raw"))) {
                    p.max_restarts = std::stoi(match[1]);
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("restart_window_seconds"\s*:\s*(\d+))raw"))) {
                    p.restart_window_seconds = std::stoi(match[1]);
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("heartbeat_file"\s*:\s*"([^"]+)")raw"))) {
                    p.heartbeat_file = match[1];
                }
                if (std::regex_search(item_content, match, std::regex(R"raw("heartbeat_timeout_seconds"\s*:\s*(\d+))raw"))) {
                    p.heartbeat_timeout_seconds = std::stoi(match[1]);
                }

                // Extract args array if present
                auto args_pos = item_content.find("\"args\"");
                if (args_pos != std::string::npos) {
                    auto args_start = item_content.find('[', args_pos);
                    auto args_end = item_content.find(']', args_pos);
                    if (args_start != std::string::npos && args_end != std::string::npos && args_end > args_start) {
                        std::string args_blob = item_content.substr(args_start + 1, args_end - args_start - 1);
                        std::regex arg_str_regex(R"raw("([^"]+)")raw");
                        auto arg_it = std::sregex_iterator(args_blob.begin(), args_blob.end(), arg_str_regex);
                        for (; arg_it != std::sregex_iterator(); ++arg_it) {
                            p.args.push_back((*arg_it)[1].str());
                        }
                    }
                }

                if (!p.name.empty()) {
                    cfg.processes.push_back(p);
                }
            }
        }
    }

    std::cout << "[INFO] Loaded configuration from " << filepath << " with " 
              << cfg.processes.size() << " monitored process(es)." << std::endl;
    return cfg;
}

} // namespace watchdog
