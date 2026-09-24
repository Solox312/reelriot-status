#!/usr/bin/env bash
# restart-hetzner.sh
# Automated rebuild, container lifecycle management, and health verification for ReelRiot Status on Hetzner Cloud.
# Usage: ./scripts/restart-hetzner.sh [--pull]
#   --pull    Execute git pull before rebuilding image (optional)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="reelriot-status:latest"
CONTAINER_NAME="reelriot-status"
PORT=3003

DO_PULL=""
for arg in "$@"; do
  case "$arg" in
    --pull) DO_PULL=1 ;;
  esac
done

cd "$ROOT_DIR"

if [[ -n "$DO_PULL" ]]; then
  echo "[restart-hetzner] Fetching latest changes from Git repository..."
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
  git fetch origin "$CURRENT_BRANCH"
  git reset --hard "origin/$CURRENT_BRANCH"
fi

if ! docker buildx version >/dev/null 2>&1; then
  echo "[restart-hetzner] Installing docker buildx component..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && (apt-get install -y -qq docker-buildx-plugin || apt-get install -y -qq docker-buildx || true)
  fi
fi

echo "[restart-hetzner] Building Docker container image: $IMAGE_NAME with BuildKit..."
DOCKER_BUILDKIT=1 docker build -t "$IMAGE_NAME" .

echo "[restart-hetzner] Inspecting and terminating existing port $PORT bindings..."

# 1. Terminate any Docker container bound to port 3003
EXISTING_CONTAINERS=$(docker ps -q --filter "publish=$PORT" 2>/dev/null || true)
if [[ -n "$EXISTING_CONTAINERS" ]]; then
  echo "[restart-hetzner] Stopping container(s) utilizing port $PORT: $EXISTING_CONTAINERS"
  docker stop "$EXISTING_CONTAINERS" 2>/dev/null || true
  docker rm "$EXISTING_CONTAINERS" 2>/dev/null || true
fi

# 2. Terminate legacy host processes on port 3003 if any
LOCAL_PID=$(lsof -t -i:"$PORT" 2>/dev/null || true)
if [[ -n "$LOCAL_PID" ]]; then
  echo "[restart-hetzner] Killing host process bound to port $PORT: PID $LOCAL_PID"
  kill -9 "$LOCAL_PID" 2>/dev/null || true
fi

# 3. Ensure target container name is freed
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "[restart-hetzner] Launching $CONTAINER_NAME container on 127.0.0.1:$PORT..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 127.0.0.1:"$PORT":"$PORT" \
  --memory=1g \
  "$IMAGE_NAME"

echo "[restart-hetzner] Pruning old untagged images (preserving active build cache)..."
docker image prune -f --filter "until=48h" 2>/dev/null || true
docker builder prune -f --filter "until=168h" --keep-storage 2GB 2>/dev/null || true

echo "[restart-hetzner] Verification: Inspecting container health..."
sleep 3
if docker ps -f "name=$CONTAINER_NAME" --format "{{.Status}}" | grep -qi "Up"; then
  echo "✅ Application container $CONTAINER_NAME started successfully on 127.0.0.1:$PORT."
  echo "Log Inspection: docker logs -f $CONTAINER_NAME"
else
  echo "❌ Container failed to start. Review logs below:"
  docker logs --tail 50 "$CONTAINER_NAME"
  exit 1
fi
