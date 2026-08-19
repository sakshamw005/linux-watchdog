#include "event.h"

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

std::string Event::toJson() const {
    std::ostringstream ss;
    ss << "{"
       << "\"timestamp\":\"" << escapeJson(timestamp) << "\","
       << "\"pid\":" << pid << ","
       << "\"process_name\":\"" << escapeJson(process_name) << "\","
       << "\"event_type\":\"" << eventTypeToString(event_type) << "\","
       << "\"severity\":\"" << severityToString(severity) << "\","
       << "\"value\":" << std::fixed << std::setprecision(2) << value << ","
       << "\"threshold\":" << std::fixed << std::setprecision(2) << threshold << ","
       << "\"message\":\"" << escapeJson(message) << "\","
       << "\"diagnosis\":\"" << escapeJson(diagnosis) << "\""
       << "}";
    return ss.str();
}

std::string WatchdogAction::toJson() const {
    std::ostringstream ss;
    ss << "{"
       << "\"timestamp\":\"" << escapeJson(timestamp) << "\","
       << "\"pid\":" << pid << ","
       << "\"process_name\":\"" << escapeJson(process_name) << "\","
       << "\"action\":\"" << escapeJson(action) << "\","
       << "\"result\":\"" << escapeJson(result) << "\","
       << "\"message\":\"" << escapeJson(message) << "\""
       << "}";
    return ss.str();
}

} // namespace watchdog
