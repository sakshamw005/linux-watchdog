cmake_minimum_required(VERSION 3.14)
project(watchdog_agent CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler flags
add_compile_options(-Wall -Wextra -Wpedantic -O2)

find_package(CURL REQUIRED)
find_package(Threads REQUIRED)

include_directories(include)

set(SOURCES
    src/main.cpp
    src/config.cpp
    src/event.cpp
    src/process_monitor.cpp
    src/resource_monitor.cpp
    src/http_client.cpp
    src/watchdog.cpp
)

add_executable(watchdog_agent ${SOURCES})

target_link_libraries(watchdog_agent
    PRIVATE
        CURL::libcurl
        Threads::Threads
)
