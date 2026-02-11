#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/infra/.env}"
RESTART=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    --no-restart)
      RESTART=0
      shift
      ;;
    --restart)
      RESTART=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ENV file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

TUNNELS_JSON="$(curl -fsS http://127.0.0.1:4040/api/tunnels)"

NGROK_INFO="$(TUNNELS_JSON="$TUNNELS_JSON" python3 - <<'PY'
import json, os, sys, re

raw = os.environ.get("TUNNELS_JSON", "")
if not raw:
    sys.exit(2)

data = json.loads(raw)
items = data.get("tunnels") or []

def score(t):
    addr = ((t.get("config") or {}).get("addr") or "").lower()
    proto = (t.get("proto") or "").lower()
    s = 0
    if ":9000" in addr or "9000" in addr:
        s += 10
    if proto == "https":
        s += 5
    return s

items.sort(key=score, reverse=True)
if not items:
    sys.exit(3)

chosen = items[0]
public_url = chosen.get("public_url") or ""
if not public_url:
    sys.exit(4)

m = re.match(r"^(https?)://([^/]+)", public_url)
if not m:
    sys.exit(5)

scheme, hostport = m.group(1), m.group(2)
ssl = "true" if scheme == "https" else "false"
print(hostport)
print(ssl)
PY
)"

NGROK_ENDPOINT="$(echo "$NGROK_INFO" | sed -n '1p')"
NGROK_SSL="$(echo "$NGROK_INFO" | sed -n '2p')"

if [[ -z "$NGROK_ENDPOINT" ]]; then
  echo "No ngrok tunnel found for MinIO (port 9000)." >&2
  exit 1
fi

python3 - <<'PY' "$ENV_FILE" "$NGROK_ENDPOINT" "$NGROK_SSL"
import sys
from pathlib import Path

path = Path(sys.argv[1])
endpoint = sys.argv[2]
ssl = sys.argv[3]

text = path.read_text()
lines = text.splitlines()

keys = {
    "MINIO_PUBLIC_ENDPOINT": endpoint,
    "MINIO_PUBLIC_USE_SSL": ssl,
}

seen = set()
new_lines = []
for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith('#') or '=' not in line:
        new_lines.append(line)
        continue
    k, v = line.split('=', 1)
    if k in keys:
        new_lines.append(f"{k}={keys[k]}")
        seen.add(k)
    else:
        new_lines.append(line)

for k, v in keys.items():
    if k not in seen:
        new_lines.append(f"{k}={v}")

path.write_text("\n".join(new_lines) + "\n")
PY

echo "Updated $ENV_FILE:"
echo "  MINIO_PUBLIC_ENDPOINT=$NGROK_ENDPOINT"
echo "  MINIO_PUBLIC_USE_SSL=$NGROK_SSL"

if [[ "$RESTART" == "1" ]]; then
  echo "Restarting api/worker containers..."
  docker compose -f "$ROOT_DIR/infra/docker-compose.yml" up -d --build api worker
fi
