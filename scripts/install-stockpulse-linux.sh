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
  echo "[1/5] Installing Docker engine and compose plugin..."
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
  echo "[1/5] Docker is already installed."
fi

echo "[2/5] Enabling Docker service..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable docker
  systemctl restart docker
fi

if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "${SUDO_USER}" || true
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker compose plugin is missing. Install docker-compose-plugin package."
  exit 1
fi

echo "[3/5] Preparing .env and secure defaults..."
bash scripts/stack-up.sh

if [[ -n "${SUDO_USER:-}" && -f .env ]]; then
  chown "${SUDO_USER}:$(id -gn "${SUDO_USER}")" .env || true
fi

echo "[4/5] Current stack status:"
docker compose ps

echo "[5/5] Done."

echo
echo "Done. StockPulse is running."
echo "App:      http://127.0.0.1:3000"
echo "Postgres: 127.0.0.1:5432"
echo "Redis:    127.0.0.1:6379"
echo
echo "If this is your first run, re-login to apply docker group membership:"
echo "  logout && login"
