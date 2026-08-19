#include <iostream>
#include <fstream>
#include <string>
#include <chrono>
#include <thread>
#include <csignal>
#include <unistd.h>
#include <sys/stat.h>

void touchHeartbeat(const std::string& path) {
    if (path.empty()) return;
    auto last_slash = path.rfind('/');
    if (last_slash != std::string::npos) {
        std::string dir = path.substr(0, last_slash);
        mkdir(dir.c_str(), 0755);
    }
    std::ofstream f(path, std::ios::trunc);
    if (f.is_open()) {
        f << std::chrono::system_clock::to_time_t(std::chrono::system_clock::now()) << "\n";
    }
}

int main(int argc, char* argv[]) {
    std::string heartbeat_file = "/tmp/watchdog/test_service.heartbeat";
    int interval_sec = 1;
    int crash_after_sec = 0;
    int exit_after_sec = 0;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--heartbeat" && i + 1 < argc) {
            heartbeat_file = argv[++i];
        } else if (arg == "--interval" && i + 1 < argc) {
            interval_sec = std::stoi(argv[++i]);
        } else if (arg == "--crash-after" && i + 1 < argc) {
            crash_after_sec = std::stoi(argv[++i]);
        } else if (arg == "--exit-after" && i + 1 < argc) {
            exit_after_sec = std::stoi(argv[++i]);
        }
    }

    std::cout << "[test_service] Started with PID " << getpid() 
              << ", heartbeat=" << heartbeat_file << std::endl;

    auto start = std::chrono::steady_clock::now();
    int count = 0;

    while (true) {
        touchHeartbeat(heartbeat_file);
        count++;
        std::cout << "[test_service] Heartbeat #" << count << " (PID: " << getpid() << ")" << std::endl;

        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - start).count();

        if (crash_after_sec > 0 && elapsed >= crash_after_sec) {
            std::cerr << "[test_service] Simulating intentional CRASH via SIGSEGV after " 
                      << elapsed << "s!" << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            raise(SIGSEGV);
        }

        if (exit_after_sec > 0 && elapsed >= exit_after_sec) {
            std::cerr << "[test_service] Simulating intentional exit(1) after " 
                      << elapsed << "s!" << std::endl;
            exit(1);
        }

        std::this_thread::sleep_for(std::chrono::seconds(interval_sec));
    }

    return 0;
}
