#include <iostream>
#include <vector>
#include <thread>
#include <chrono>
#include <atomic>
#include <cmath>

static std::atomic<bool> g_running{true};

void burnCpu() {
    double val = 1234567.89;
    while (g_running) {
        val = std::sin(val) * std::cos(val) + std::sqrt(std::fabs(val));
    }
}

int main(int argc, char* argv[]) {
    int num_threads = std::thread::hardware_concurrency();
    if (num_threads <= 0) num_threads = 2;
    int duration_sec = 20;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--threads" && i + 1 < argc) {
            num_threads = std::stoi(argv[++i]);
        } else if (arg == "--duration" && i + 1 < argc) {
            duration_sec = std::stoi(argv[++i]);
        }
    }

    std::cout << "[cpu_stress] Starting CPU stress with " << num_threads 
              << " threads for " << duration_sec << " seconds..." << std::endl;

    std::vector<std::thread> workers;
    for (int i = 0; i < num_threads; ++i) {
        workers.emplace_back(burnCpu);
    }

    std::this_thread::sleep_for(std::chrono::seconds(duration_sec));
    g_running = false;

    for (auto& t : workers) {
        if (t.joinable()) t.join();
    }

    std::cout << "[cpu_stress] Completed CPU stress run." << std::endl;
    return 0;
}
