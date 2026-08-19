#include "config.h"
#include "watchdog.h"
#include <iostream>
#include <csignal>
#include <unistd.h>
#include <atomic>

static std::atomic<bool> g_running{true};
static watchdog::WatchdogEngine* g_engine{nullptr};

void signalHandler(int signum) {
    std::cout << "\n[INFO] Caught signal " << signum << ". Stopping watchdog agent..." << std::endl;
    g_running = false;
    if (g_engine) {
        g_engine->shutdown();
    }
}

int main(int argc, char* argv[]) {
    std::cout << "========================================================" << std::endl;
    std::cout << "  Embedded Linux Process Watchdog & Systems Monitor    " << std::endl;
    std::cout << "========================================================" << std::endl;

    std::string config_path = "config/watchdog.json";
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if ((arg == "-c" || arg == "--config") && i + 1 < argc) {
            config_path = argv[++i];
        } else if (arg == "-h" || arg == "--help") {
            std::cout << "Usage: " << argv[0] << " [options]\n"
                      << "Options:\n"
                      << "  -c, --config <file>   Path to watchdog.json configuration file\n"
                      << "  -h, --help            Display this help message\n";
            return 0;
        }
    }

    watchdog::Config config = watchdog::Config::loadFromFile(config_path);
    watchdog::WatchdogEngine engine(config);
    g_engine = &engine;

    // Register signal handlers
    struct sigaction sa;
    sa.sa_handler = signalHandler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGINT, &sa, nullptr);
    sigaction(SIGTERM, &sa, nullptr);

    engine.initialize();

    std::cout << "[INFO] Watchdog loop started. Polling every " 
              << config.monitor_interval_seconds << " second(s). Press Ctrl+C to terminate." << std::endl;

    while (g_running) {
        engine.runCycle();
        sleep(config.monitor_interval_seconds);
    }

    std::cout << "[INFO] Watchdog agent terminated cleanly." << std::endl;
    return 0;
}
