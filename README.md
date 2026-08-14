# linux-watchdog
***
embedded-linux-watchdog/
│
├── agent/
│   ├── include/
│   │   ├── process_monitor.h
│   │   ├── resource_monitor.h
│   │   ├── watchdog.h
│   │   └── event.h
│   │
│   ├── src/
│   │   ├── main.cpp
│   │   ├── process_monitor.cpp
│   │   ├── resource_monitor.cpp
│   │   ├── watchdog.cpp
│   │   └── event.cpp
│   │
│   └── CMakeLists.txt
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   ├── database/
│   │   └── models/
│   │
│   └── requirements.txt
│
├── dashboard/
│   ├── src/
│   └── package.json
│
├── tests/
│   ├── cpu_stress/
│   ├── memory_leak/
│   ├── crash_test/
│   └── hang_test/
│
├── config/
│   └── watchdog.yaml
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── testing.md
│
├── README.md
└── .gitignore
***
