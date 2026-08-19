# Embedded Linux Process Watchdog & Systems Monitor

A lightweight, rule-based systems monitoring and watchdog application designed for Linux environments. The project features a native C++ agent that gathers system telemetry from `/proc` and `/sys`, executes recovery actions, and forwards data to a FastAPI backend that persists metrics in SQLite and exposes a real-time React dashboard.

---

## Key Features
- **Deterministic Rules Engine**: CPU saturation, memory exhaustion/leaks, and filesystem disk thresholds detected via rule-based logic (zero machine learning dependencies).
- **Process Crash Detection & Recovery**: Automatic tracking and spawning of configured services using proper POSIX process control (`fork`/`exec`).
- **Restart Loop Protection**: Restricts the maximum number of restarts within a sliding window to prevent system thrashing.
- **Process Hang Detection**: Implements a file-timestamp heartbeat listener to recover deadlocked or unresponsive processes.
- **Explainable Health Scoring**: Dynamically calculates a system health score (0-100) based on active alerts and process run states.
- **Real-Time SOC Dashboard**: Responsive frontend displaying live charts, process details, and an incident forensic timeline.

---

## Repository Structure

```text
linux-watchdog/
│
├── agent/
│   ├── include/
│   │   ├── config.h
│   │   ├── event.h
│   │   ├── http_client.h
│   │   ├── process_monitor.h
│   │   ├── resource_monitor.h
│   │   └── watchdog.h
│   │
│   ├── src/
│   │   ├── config.cpp
│   │   ├── event.cpp
│   │   ├── http_client.cpp
│   │   ├── main.cpp
│   │   ├── process_monitor.cpp
│   │   ├── resource_monitor.cpp
│   │   └── watchdog.cpp
│   │
│   └── CMakeLists.txt
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── events.py
│   │   │   ├── metrics.py
│   │   │   ├── processes.py
│   │   │   ├── system.py
│   │   │   └── watchdog.py
│   │   ├── services/
│   │   │   ├── diagnostic_engine.py
│   │   │   └── health_engine.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── tests/
│   │   └── test_api.py
│   └── requirements.txt
│
├── config/
│   └── watchdog.json
│
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DiagnosticCard.tsx
│   │   │   ├── HealthGauge.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── ProcessDetailModal.tsx
│   │   │   └── ResourceChart.tsx
│   │   ├── pages/
│   │   │   ├── AlertsPage.tsx
│   │   │   ├── IncidentTimelinePage.tsx
│   │   │   ├── OverviewPage.tsx
│   │   │   ├── ProcessesPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── deployment/
│   ├── install.sh
│   └── watchdog-agent.service
│
├── tests/
│   ├── cpu_stress/
│   │   └── cpu_stress.cpp
│   ├── crash_test/
│   │   └── test_service.cpp
│   ├── hang_test/
│   │   └── hang_service.cpp
│   ├── memory_stress/
│   │   └── memory_stress.cpp
│   └── run_e2e_tests.sh
│
└── README.md
```

---

## Installation & Setup Instructions

Ensure you are using a Linux host, Raspberry Pi, or Windows Subsystem for Linux (WSL) with development tools installed:
```bash
sudo apt update
sudo apt install -y build-essential cmake libcurl4-openssl-dev python3 python3-pip python3-venv curl
```

### 1. Build the C++ Watchdog Agent
Compile the agent binary using CMake:
```bash
cd agent
mkdir -p build && cd build
cmake ..
make
```
This builds the `watchdog_agent` executable inside `agent/build/`.

### 2. Start the Backend API
Run the FastAPI application:
```bash
cd ../../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Note: Wiping `backend/watchdog.db` resets all historical logs and health scores to clean/default state.*

### 3. Start the Dashboard UI
Install frontend dependencies and start the Vite dev server:
```bash
cd ../dashboard
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## Running Telemetry and Anomaly Verification

To manually inject faults and observe rules, build the stress testing suite:
```bash
cd ../tests
mkdir -p build && cd build
cmake ..
make
```

### Run Monitored Process Crash & Recovery
Start the watchdog agent from the project root:
```bash
cd ../..
./agent/build/watchdog_agent --config config/watchdog.json
```
The agent automatically spawns the configured `test_service`. In a separate terminal, crash it:
```bash
kill -9 $(pgrep -f "test_service")
```
*Look at the dashboard timeline to see the crash event log, the restart action, and the subsequent recovery event.*

### Simulate CPU Stress
Run the CPU stress utility:
```bash
./tests/build/cpu_stress/cpu_stress --threads 4 --duration 10
```
*Observe real-time CPU spikes on the charts and the rule-based warning alert generated in the alerts tab.*

### Run Automated End-to-End Test Suite
Run the pre-configured integration verification script to check API, database, and telemetry pipelines:
```bash
./tests/run_e2e_tests.sh
```

---

## Systemd Service Deployment
To install and run the watchdog agent as a system service:
```bash
sudo chmod +x deployment/install.sh
sudo ./deployment/install.sh
sudo systemctl enable watchdog-agent
sudo systemctl start watchdog-agent
sudo systemctl status watchdog-agent
```
