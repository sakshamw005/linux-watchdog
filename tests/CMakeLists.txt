cmake_minimum_required(VERSION 3.14)
project(watchdog_fault_tests CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_compile_options(-Wall -Wextra -O2)

find_package(Threads REQUIRED)

add_executable(test_service crash_test/test_service.cpp)
target_link_libraries(test_service PRIVATE Threads::Threads)
set_target_properties(test_service PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/crash_test")

add_executable(cpu_stress cpu_stress/cpu_stress.cpp)
target_link_libraries(cpu_stress PRIVATE Threads::Threads)
set_target_properties(cpu_stress PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/cpu_stress")

add_executable(memory_stress memory_stress/memory_stress.cpp)
target_link_libraries(memory_stress PRIVATE Threads::Threads)
set_target_properties(memory_stress PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/memory_stress")

add_executable(hang_service hang_test/hang_service.cpp)
target_link_libraries(hang_service PRIVATE Threads::Threads)
set_target_properties(hang_service PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/hang_test")
