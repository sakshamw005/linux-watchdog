import pytest
from fastapi.testclient import TestClient
import os
import tempfile
import sqlite3

# Set test DB environment variable before importing app
test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["WATCHDOG_DB_PATH"] = test_db.name

from app.main import app
from app.database import init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    init_db()
    yield

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ONLINE"

def test_ingest_metrics_and_query():
    payload = {
        "system": {
            "timestamp": "2026-08-18T10:00:00.000Z",
            "cpu_percent": 35.5,
            "memory_total_bytes": 16000000000,
            "memory_used_bytes": 8000000000,
            "memory_available_bytes": 8000000000,
            "memory_percent": 50.0,
            "disk_total_bytes": 100000000000,
            "disk_used_bytes": 45000000000,
            "disk_percent": 45.0,
            "load_1m": 1.2,
            "load_5m": 0.8,
            "load_15m": 0.5,
            "net_rx_bytes": 10240,
            "net_tx_bytes": 20480
        },
        "monitored_processes": [
            {
                "pid": 1234,
                "name": "test_service",
                "state": "S",
                "ppid": 1,
                "cpu_percent": 12.0,
                "memory_bytes": 104857600,
                "vm_size_bytes": 209715200,
                "memory_percent": 0.65,
                "thread_count": 4,
                "uptime_seconds": 120.5,
                "cmdline": "./tests/crash_test/test_service"
            }
        ],
        "all_processes": []
    }

    # Ingest metrics
    ingest_res = client.post("/api/agent/metrics", json=payload)
    assert ingest_res.status_code == 200
    assert ingest_res.json()["status"] == "SUCCESS"

    # Query system
    sys_res = client.get("/api/system")
    assert sys_res.status_code == 200
    assert sys_res.json()["cpu_percent"] == 35.5
    assert sys_res.json()["memory_percent"] == 50.0

    # Query processes
    proc_res = client.get("/api/processes")
    assert proc_res.status_code == 200
    procs = proc_res.json()
    assert len(procs) >= 1
    assert procs[0]["name"] == "test_service"
    assert procs[0]["pid"] == 1234

    # Query process detail
    detail_res = client.get("/api/processes/1234")
    assert detail_res.status_code == 200
    assert detail_res.json()["process"]["pid"] == 1234

def test_events_and_rule_diagnostics():
    # Test High CPU Event
    cpu_event = {
        "timestamp": "2026-08-18T10:01:00.000Z",
        "pid": 1234,
        "process_name": "test_service",
        "event_type": "HIGH_CPU",
        "severity": "WARNING",
        "value": 94.5,
        "threshold": 90.0,
        "message": "Process CPU exceeded threshold"
    }
    res = client.post("/api/agent/events", json=cpu_event)
    assert res.status_code == 200
    data = res.json()
    assert "diagnosis" in data
    assert data["diagnosis"]["rule_id"] == "RULE_CPU_SATURATION"
    assert "CPU saturation detected." in data["diagnosis"]["probable_cause"]

    # Test Monotonic Memory Growth Event
    mem_event = {
        "timestamp": "2026-08-18T10:02:00.000Z",
        "pid": 1234,
        "process_name": "test_service",
        "event_type": "MEMORY_GROWTH",
        "severity": "WARNING",
        "value": 82.0,
        "threshold": 5.0,
        "message": "Continuous memory growth observed"
    }
    res2 = client.post("/api/agent/events", json=mem_event)
    assert res2.status_code == 200
    assert res2.json()["diagnosis"]["rule_id"] == "RULE_MEMORY_GROWTH"

    # Test Process Hang Event
    hang_event = {
        "timestamp": "2026-08-18T10:03:00.000Z",
        "pid": 1234,
        "process_name": "test_service",
        "event_type": "PROCESS_HANG",
        "severity": "CRITICAL",
        "value": 15.0,
        "threshold": 5.0,
        "message": "Heartbeat timeout"
    }
    res3 = client.post("/api/agent/events", json=hang_event)
    assert res3.status_code == 200
    assert res3.json()["diagnosis"]["rule_id"] == "RULE_PROCESS_HANG"

    # Query events list
    events_res = client.get("/api/events")
    assert events_res.status_code == 200
    assert len(events_res.json()) >= 3

def test_watchdog_actions_and_status():
    action_payload = {
        "timestamp": "2026-08-18T10:04:00.000Z",
        "pid": 5678,
        "process_name": "test_service",
        "action": "RESTART",
        "result": "SUCCESS",
        "message": "Automatic watchdog restart."
    }
    res = client.post("/api/agent/actions", json=action_payload)
    assert res.status_code == 200

    status_res = client.get("/api/watchdog/status")
    assert status_res.status_code == 200
    assert status_res.json()["total_restarts"] >= 1

def test_incidents_timeline():
    # Query incidents
    inc_res = client.get("/api/events/incidents")
    assert inc_res.status_code == 200
    incidents = inc_res.json()
    assert len(incidents) >= 1
    assert incidents[0]["process_name"] == "test_service"
    assert len(incidents[0]["timeline"]) >= 1

def test_health_score_calculation():
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    health_data = health_res.json()
    assert "score" in health_data
    assert "status" in health_data
    assert "penalties" in health_data
    assert 0 <= health_data["score"] <= 100
