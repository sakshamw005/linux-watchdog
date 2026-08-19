#include "process_monitor.h"
#include <dirent.h>
#include <unistd.h>
#include <sys/types.h>
#include <fstream>
#include <sstream>
#include <iostream>
#include <iomanip>
#include <algorithm>
#include <cstring>

namespace watchdog {

static std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (auto c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if (static_cast<unsigned char>(c) <= 0x1f) {
            o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
        } else {
            o << c;
        }
    }
    return o.str();
}

std::string ProcessInfo::toJson() const {
    std::ostringstream ss;
    ss << "{"
       << "\"pid\":" << pid << ","
       << "\"name\":\"" << escapeJson(name) << "\","
       << "\"state\":\"" << escapeJson(state) << "\","
       << "\"ppid\":" << ppid << ","
       << "\"cpu_percent\":" << std::fixed << std::setprecision(2) << cpu_percent << ","
       << "\"memory_bytes\":" << memory_bytes << ","
       << "\"vm_size_bytes\":" << vm_size_bytes << ","
       << "\"memory_percent\":" << std::fixed << std::setprecision(2) << memory_percent << ","
       << "\"thread_count\":" << thread_count << ","
       << "\"start_time_ticks\":" << start_time_ticks << ","
       << "\"uptime_seconds\":" << std::fixed << std::setprecision(1) << uptime_seconds << ","
       << "\"cmdline\":\"" << escapeJson(cmdline) << "\""
       << "}";
    return ss.str();
}

ProcessMonitor::ProcessMonitor() {
    clk_tck_ = sysconf(_SC_CLK_TCK);
    if (clk_tck_ <= 0) clk_tck_ = 100;
    
    num_cores_ = sysconf(_SC_NPROCESSORS_ONLN);
    if (num_cores_ <= 0) num_cores_ = 1;

    prev_system_total_ticks_ = readTotalSystemCpuTicks();
}

long ProcessMonitor::getClockTicksPerSecond() {
    long ticks = sysconf(_SC_CLK_TCK);
    return ticks > 0 ? ticks : 100;
}

int ProcessMonitor::getCpuCoreCount() {
    int cores = sysconf(_SC_NPROCESSORS_ONLN);
    return cores > 0 ? cores : 1;
}

double ProcessMonitor::getSystemUptimeSeconds() {
    std::ifstream file("/proc/uptime");
    if (!file.is_open()) return 0.0;
    double uptime = 0.0;
    file >> uptime;
    return uptime;
}

uint64_t ProcessMonitor::readTotalSystemCpuTicks() {
    std::ifstream file("/proc/stat");
    if (!file.is_open()) return 0;

    std::string line;
    if (std::getline(file, line)) {
        if (line.rfind("cpu ", 0) == 0) {
            std::istringstream iss(line.substr(4));
            uint64_t user, nice, system, idle, iowait, irq, softirq, steal;
            if (iss >> user >> nice >> system >> idle >> iowait >> irq >> softirq >> steal) {
                return user + nice + system + idle + iowait + irq + softirq + steal;
            }
        }
    }
    return 0;
}

bool ProcessMonitor::parseStatFile(int pid, ProcessInfo& info, uint64_t& out_utime, uint64_t& out_stime) {
    std::string path = "/proc/" + std::to_string(pid) + "/stat";
    std::ifstream file(path);
    if (!file.is_open()) return false;

    std::string line;
    if (!std::getline(file, line)) return false;

    // Process name in stat is enclosed in parentheses: (proc_name)
    auto open_paren = line.find('(');
    auto close_paren = line.rfind(')');
    if (open_paren == std::string::npos || close_paren == std::string::npos || close_paren < open_paren) {
        return false;
    }

    info.name = line.substr(open_paren + 1, close_paren - open_paren - 1);

    // Parse remaining fields after closing paren
    std::string rest = line.substr(close_paren + 2);
    std::istringstream iss(rest);

    char state_ch;
    int ppid, pgrp, session, tty_nr, tpgid;
    unsigned int flags;
    uint64_t minflt, cminflt, majflt, cmajflt, utime, stime;
    int64_t cutime, cstime, priority, nice, num_threads, itrealvalue;
    unsigned long long starttime;

    if (iss >> state_ch >> ppid >> pgrp >> session >> tty_nr >> tpgid >> flags
            >> minflt >> cminflt >> majflt >> cmajflt >> utime >> stime
            >> cutime >> cstime >> priority >> nice >> num_threads >> itrealvalue
            >> starttime) {
        info.state = std::string(1, state_ch);
        info.ppid = ppid;
        info.thread_count = static_cast<int>(num_threads);
        info.start_time_ticks = starttime;

        out_utime = utime;
        out_stime = stime;

        double sys_uptime = getSystemUptimeSeconds();
        double start_seconds = static_cast<double>(starttime) / static_cast<double>(clk_tck_);
        info.uptime_seconds = std::max(0.0, sys_uptime - start_seconds);
        return true;
    }

    return false;
}

bool ProcessMonitor::parseStatusFile(int pid, ProcessInfo& info) {
    std::string path = "/proc/" + std::to_string(pid) + "/status";
    std::ifstream file(path);
    if (!file.is_open()) return false;

    std::string line;
    while (std::getline(file, line)) {
        if (line.rfind("VmRSS:", 0) == 0) {
            std::istringstream iss(line.substr(6));
            uint64_t kb = 0;
            iss >> kb;
            info.memory_bytes = kb * 1024;
        } else if (line.rfind("VmSize:", 0) == 0) {
            std::istringstream iss(line.substr(7));
            uint64_t kb = 0;
            iss >> kb;
            info.vm_size_bytes = kb * 1024;
        } else if (line.rfind("Threads:", 0) == 0 && info.thread_count <= 1) {
            std::istringstream iss(line.substr(8));
            int threads = 1;
            iss >> threads;
            info.thread_count = threads;
        }
    }
    return true;
}

bool ProcessMonitor::parseCmdlineFile(int pid, ProcessInfo& info) {
    std::string path = "/proc/" + std::to_string(pid) + "/cmdline";
    std::ifstream file(path, std::ios::binary);
    if (!file.is_open()) return false;

    std::string result;
    char ch;
    while (file.get(ch)) {
        if (ch == '\0') {
            result += " ";
        } else {
            result += ch;
        }
    }
    if (!result.empty() && result.back() == ' ') {
        result.pop_back();
    }
    info.cmdline = result;
    return true;
}

bool ProcessMonitor::getProcessInfo(int pid, uint64_t total_ram_bytes, ProcessInfo& out_info) {
    out_info.pid = pid;
    uint64_t utime = 0, stime = 0;
    if (!parseStatFile(pid, out_info, utime, stime)) {
        return false;
    }
    parseStatusFile(pid, out_info);
    parseCmdlineFile(pid, out_info);

    if (total_ram_bytes > 0) {
        out_info.memory_percent = (static_cast<double>(out_info.memory_bytes) / static_cast<double>(total_ram_bytes)) * 100.0;
    }

    uint64_t current_sys_ticks = readTotalSystemCpuTicks();
    auto it = prev_samples_.find(pid);
    if (it != prev_samples_.end()) {
        uint64_t proc_delta = (utime + stime) >= (it->second.utime + it->second.stime)
                              ? (utime + stime) - (it->second.utime + it->second.stime)
                              : 0;
        uint64_t sys_delta = current_sys_ticks >= it->second.total_system_ticks
                             ? current_sys_ticks - it->second.total_system_ticks
                             : 0;

        if (sys_delta > 0) {
            double cpu = (static_cast<double>(proc_delta) / static_cast<double>(sys_delta)) * 100.0 * num_cores_;
            out_info.cpu_percent = std::clamp(cpu, 0.0, 100.0 * num_cores_);
        }
    }

    prev_samples_[pid] = ProcessSample{utime, stime, current_sys_ticks, 0};
    return true;
}

std::vector<ProcessInfo> ProcessMonitor::scanProcesses(uint64_t total_ram_bytes) {
    std::vector<ProcessInfo> processes;
    DIR* dir = opendir("/proc");
    if (!dir) {
        std::cerr << "[ERROR] Unable to open /proc directory" << std::endl;
        return processes;
    }

    uint64_t current_sys_ticks = readTotalSystemCpuTicks();
    std::unordered_map<int, ProcessSample> current_samples;

    struct dirent* entry;
    while ((entry = readdir(dir)) != nullptr) {
        // Check if directory name is numeric (PID)
        if (entry->d_type == DT_DIR || entry->d_type == DT_UNKNOWN) {
            char* endptr = nullptr;
            long pid_l = strtol(entry->d_name, &endptr, 10);
            if (endptr && *endptr == '\0' && pid_l > 0) {
                int pid = static_cast<int>(pid_l);
                ProcessInfo info;
                info.pid = pid;
                uint64_t utime = 0, stime = 0;

                if (parseStatFile(pid, info, utime, stime)) {
                    parseStatusFile(pid, info);
                    parseCmdlineFile(pid, info);

                    if (total_ram_bytes > 0) {
                        info.memory_percent = (static_cast<double>(info.memory_bytes) / static_cast<double>(total_ram_bytes)) * 100.0;
                    }

                    auto it = prev_samples_.find(pid);
                    if (it != prev_samples_.end()) {
                        uint64_t proc_delta = (utime + stime) >= (it->second.utime + it->second.stime)
                                              ? (utime + stime) - (it->second.utime + it->second.stime)
                                              : 0;
                        uint64_t sys_delta = current_sys_ticks >= it->second.total_system_ticks
                                             ? current_sys_ticks - it->second.total_system_ticks
                                             : 0;

                        if (sys_delta > 0) {
                            double cpu = (static_cast<double>(proc_delta) / static_cast<double>(sys_delta)) * 100.0 * num_cores_;
                            info.cpu_percent = std::clamp(cpu, 0.0, 100.0 * num_cores_);
                        }
                    }

                    current_samples[pid] = ProcessSample{utime, stime, current_sys_ticks, 0};
                    processes.push_back(std::move(info));
                }
            }
        }
    }
    closedir(dir);

    prev_samples_ = std::move(current_samples);
    prev_system_total_ticks_ = current_sys_ticks;

    return processes;
}

} // namespace watchdog
