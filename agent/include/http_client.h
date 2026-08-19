#pragma once

#include <string>
#include <chrono>

namespace watchdog {

class HttpClient {
public:
    explicit HttpClient(const std::string& base_url);
    ~HttpClient();

    // Post JSON payload to specific relative endpoint (e.g. "/api/agent/metrics")
    bool postJson(const std::string& endpoint, const std::string& json_payload);

    bool isReachable() const { return last_request_success_; }

private:
    std::string base_url_;
    bool last_request_success_{false};
    std::chrono::steady_clock::time_point last_warning_time_;
};

} // namespace watchdog
