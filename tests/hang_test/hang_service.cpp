#include <iostream>
#include <fstream>
#include <string>
#include <chrono>
#include <thread>
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
    int live_seconds = 4;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--heartbeat" && i + 1 < argc) {
            heartbeat_file = argv[++i];
        } else if (arg == "--live-sec" && i + 1 < argc) {
            live_seconds = std::stoi(argv[++i]);
        }
    }

    std::cout << "[hang_service] Started with PID " << getpid() 
              << ". Updating heartbeat for " << live_seconds << "s, then simulating deadlock..." << std::endl;

    for (int i = 1; i <= live_seconds; ++i) {
        touchHeartbeat(heartbeat_file);
        std::cout << "[hang_service] Healthy heartbeat " << i << "/" << live_seconds << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    std::cout << "[hang_service] SIMULATING DEADLOCK / HANG: stopping heartbeat while process stays alive!" << std::endl;
    // Enter infinite sleep without touching heartbeat
    while (true) {
        std::this_thread::sleep_for(std::chrono::seconds(60));
    }

    return 0;
}
