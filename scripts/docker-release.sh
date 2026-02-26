#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 v0.14.0"
  exit 1
fi

echo "Building copilot-api ${VERSION}..."

# Build
cd "$(dirname "$0")/.."
bun run build
cd web && bun run build && cd ..

# Docker build and push
docker build -t ghcr.io/ritel-t/copilot-api:${VERSION} -t ghcr.io/ritel-t/copilot-api:latest .
docker push ghcr.io/ritel-t/copilot-api:${VERSION}
docker push ghcr.io/ritel-t/copilot-api:latest

echo "Done! Published ghcr.io/ritel-t/copilot-api:${VERSION}"
