#include <iostream>
#include <vector>
#include <chrono>
#include <thread>
#include <cstring>
#include <unistd.h>

int main(int argc, char* argv[]) {
    int chunk_mb = 50;
    int max_mb = 800;
    int interval_ms = 1000;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--chunk-mb" && i + 1 < argc) {
            chunk_mb = std::stoi(argv[++i]);
        } else if (arg == "--max-mb" && i + 1 < argc) {
            max_mb = std::stoi(argv[++i]);
        } else if (arg == "--interval-ms" && i + 1 < argc) {
            interval_ms = std::stoi(argv[++i]);
        }
    }

    std::cout << "[memory_stress] Starting monotonic memory allocation (chunk=" 
              << chunk_mb << "MB, max=" << max_mb << "MB, interval=" << interval_ms << "ms)..." << std::endl;

    std::vector<char*> allocated_chunks;
    int total_allocated_mb = 0;

    while (total_allocated_mb < max_mb) {
        size_t bytes = static_cast<size_t>(chunk_mb) * 1024 * 1024;
        char* buffer = new (std::nothrow) char[bytes];
        if (!buffer) {
            std::cerr << "[memory_stress] Allocation failed at " << total_allocated_mb << "MB!" << std::endl;
            break;
        }

        // Touch every page (4KB) so that OS actually commits the pages to physical RAM
        for (size_t offset = 0; offset < bytes; offset += 4096) {
            buffer[offset] = static_cast<char>(offset & 0xFF);
        }

        allocated_chunks.push_back(buffer);
        total_allocated_mb += chunk_mb;

        std::cout << "[memory_stress] Allocated " << total_allocated_mb << " MB total" << std::endl;
        std::this_thread::sleep_for(std::chrono::milliseconds(interval_ms));
    }

    std::cout << "[memory_stress] Target reached (" << total_allocated_mb << " MB). Holding for 15s..." << std::endl;
    std::this_thread::sleep_for(std::chrono::seconds(15));

    // Cleanup
    for (char* ptr : allocated_chunks) {
        delete[] ptr;
    }

    std::cout << "[memory_stress] Memory released. Exiting cleanly." << std::endl;
    return 0;
}
