#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker first, then run: npm run stack:up"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required. Install docker compose plugin first."
  exit 1
fi

if [[ ! -f .env.stack.example ]]; then
  echo "Missing .env.stack.example template."
  exit 1
fi

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

if [[ ! -f .env ]]; then
  cp .env.stack.example .env
  sed -i.bak "s|^AUTH_SESSION_SECRET=.*|AUTH_SESSION_SECRET=$(gen_secret 32)|" .env
  sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(gen_secret 16)|" .env
  echo "Created .env with generated secrets."
fi

if grep -q "^AUTH_SESSION_SECRET=replace-with-strong-secret$" .env; then
  sed -i.bak "s|^AUTH_SESSION_SECRET=.*|AUTH_SESSION_SECRET=$(gen_secret 32)|" .env
  echo "Generated AUTH_SESSION_SECRET in .env."
fi

if grep -q "^POSTGRES_PASSWORD=replace-with-strong-password$" .env; then
  sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(gen_secret 16)|" .env
  echo "Generated POSTGRES_PASSWORD in .env."
fi

rm -f .env.bak

docker compose up -d --build --remove-orphans
docker compose ps
