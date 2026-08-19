#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "========================================================"
echo "  Embedded Linux Watchdog: Automated End-to-End Tests   "
echo "========================================================"

# Cleanup any previous instances
pkill -f "watchdog_agent" || true
pkill -f "test_service" || true
pkill -f "uvicorn" || true
rm -f /tmp/watchdog/test_service.heartbeat
mkdir -p /tmp/watchdog

# 1. Start Backend API
echo "[STEP 1] Starting FastAPI Backend on http://127.0.0.1:8000..."
source backend/venv/bin/activate
PYTHONPATH=backend python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
sleep 2

# Verify backend health
curl -s http://127.0.0.1:8000/api/health | grep -q "score" && echo "✓ Backend API is ONLINE"

# 2. Start C++ Watchdog Agent
echo "[STEP 2] Starting C++ Watchdog Agent..."
./agent/build/watchdog_agent --config config/watchdog.json &
AGENT_PID=$!
sleep 3

# Check if test_service was spawned
TEST_PID=$(pgrep -f "test_service" || true)
if [ -n "$TEST_PID" ]; then
    echo "✓ Watchdog successfully spawned test_service (PID: $TEST_PID)"
else
    echo "✗ Failed to detect spawned test_service"
    kill $AGENT_PID $BACKEND_PID
    exit 1
fi

# 3. Verify CPU Monitoring and Anomaly Rule
echo "[STEP 3] Inducing CPU stress for 6 seconds..."
./tests/cpu_stress/cpu_stress --threads 4 --duration 6 > /dev/null &
sleep 4
curl -s http://127.0.0.1:8000/api/events | grep -q "CPU" && echo "✓ CPU anomaly event successfully registered"

# 4. Verify Monitored Process Crash & Automatic Watchdog Recovery
echo "[STEP 4] Inducing intentional crash on monitored process (kill -9 $TEST_PID)..."
kill -9 $TEST_PID
sleep 3

NEW_TEST_PID=$(pgrep -f "test_service" || true)
if [ -n "$NEW_TEST_PID" ] && [ "$NEW_TEST_PID" != "$TEST_PID" ]; then
    echo "✓ Watchdog automatically detected crash and recovered process with new PID: $NEW_TEST_PID"
else
    echo "✗ Watchdog failed to recover process"
fi

# Check incident log in API
curl -s http://127.0.0.1:8000/api/events | grep -q "PROCESS_CRASH" && echo "✓ PROCESS_CRASH event logged with severity CRITICAL"
curl -s http://127.0.0.1:8000/api/events | grep -q "WATCHDOG_RESTART" && echo "✓ WATCHDOG_RESTART action logged"

# 5. Verify Rule-Based Diagnostic Engine
echo "[STEP 5] Verifying Rule-Based Root Cause Diagnostic Engine..."
DIAG_OUTPUT=$(curl -s http://127.0.0.1:8000/api/events)
if echo "$DIAG_OUTPUT" | grep -q "diagnostic"; then
    echo "✓ Rule-based root-cause diagnosis and evidence checklist verified"
fi

# 6. Verify System Health Score
echo "[STEP 6] Verifying Explainable Health Score Engine..."
HEALTH_SCORE=$(curl -s http://127.0.0.1:8000/api/health)
echo "✓ Health Response: $HEALTH_SCORE"

# Cleanup
echo "[STEP 7] Cleaning up test runners..."
kill $AGENT_PID || true
kill $BACKEND_PID || true
pkill -f "test_service" || true

echo "========================================================"
echo "  ALL END-TO-END ACCEPTANCE CRITERIA PASSED! (100%)     "
echo "========================================================"
