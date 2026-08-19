#include "http_client.h"
#include <curl/curl.h>
#include <iostream>

namespace watchdog {

static size_t writeCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    (void)contents;
    (void)userp;
    return size * nmemb; // Discard response body or consume it
}

HttpClient::HttpClient(const std::string& base_url) : base_url_(base_url) {
    // Trim trailing slash if present
    if (!base_url_.empty() && base_url_.back() == '/') {
        base_url_.pop_back();
    }
    curl_global_init(CURL_GLOBAL_DEFAULT);
    last_warning_time_ = std::chrono::steady_clock::now() - std::chrono::seconds(60);
}

HttpClient::~HttpClient() {
    curl_global_cleanup();
}

bool HttpClient::postJson(const std::string& endpoint, const std::string& json_payload) {
    CURL* curl = curl_easy_init();
    if (!curl) {
        std::cerr << "[ERROR] Failed to initialize curl handle" << std::endl;
        return false;
    }

    std::string full_url = base_url_ + endpoint;
    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "Accept: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, full_url.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(json_payload.size()));
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, 1500L); // 1.5 second max
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, 1000L); // 1.0 second connect
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    CURLcode res = curl_easy_perform(curl);
    long http_code = 0;
    if (res == CURLE_OK) {
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res == CURLE_OK && (http_code >= 200 && http_code < 300)) {
        last_request_success_ = true;
        return true;
    } else {
        last_request_success_ = false;
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::seconds>(now - last_warning_time_).count() >= 30) {
            std::cerr << "[WARNING] Backend API unavailable at " << full_url 
                      << " (status=" << http_code << ", curl_err=" << curl_easy_strerror(res) 
                      << "). Watchdog continues autonomous monitoring." << std::endl;
            last_warning_time_ = now;
        }
        return false;
    }
}

} // namespace watchdog
