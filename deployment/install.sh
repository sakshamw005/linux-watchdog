#!/usr/bin/env bash
set -e

echo "=== Installing Embedded Linux Watchdog Agent ==="

INSTALL_DIR="/opt/embedded-watchdog"
SERVICE_FILE="/etc/systemd/system/watchdog-agent.service"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Create installation target directory
sudo mkdir -p "${INSTALL_DIR}"
sudo cp -r "${CURRENT_DIR}/agent" "${INSTALL_DIR}/"
sudo cp -r "${CURRENT_DIR}/config" "${INSTALL_DIR}/"
sudo mkdir -p /tmp/watchdog

# Generate systemd service with actual path
cat <<EOF | sudo tee "${SERVICE_FILE}" > /dev/null
[Unit]
Description=Embedded Linux Process Watchdog & Systems Monitoring Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/agent/build/watchdog_agent --config ${INSTALL_DIR}/config/watchdog.json
Restart=always
RestartSec=5s
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# Reload and enable service
sudo systemctl daemon-reload
echo "Systemd service installed to ${SERVICE_FILE}."
echo ""
echo "To enable and start the service:"
echo "  sudo systemctl enable watchdog-agent"
echo "  sudo systemctl start watchdog-agent"
echo "  sudo systemctl status watchdog-agent"
