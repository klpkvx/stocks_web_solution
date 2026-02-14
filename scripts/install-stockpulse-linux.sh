#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash scripts/install-stockpulse-linux.sh"
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer currently supports Debian/Ubuntu (apt-get)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[1/4] Installing Docker engine and compose plugin..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  source /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "[1/4] Docker is already installed."
fi

echo "[2/4] Enabling Docker service..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable docker
  systemctl restart docker
fi

if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "${SUDO_USER}" || true
fi

echo "[3/4] Starting StockPulse stack (app + postgres + redis)..."
docker compose up -d --build

echo "[4/4] Current stack status:"
docker compose ps

echo
echo "Done. StockPulse is running."
echo "App:      http://127.0.0.1:3000"
echo "Postgres: 127.0.0.1:5432"
echo "Redis:    127.0.0.1:6379"
echo
echo "If this is your first run, re-login to apply docker group membership:"
echo "  logout && login"
