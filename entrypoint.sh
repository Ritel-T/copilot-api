#!/bin/sh

# Default mode: console (multi-account management)
# Supports: docker run ... [start|console] [args...]

MODE="${1:-console}"

case "$MODE" in
  start)
    shift
    if [ -n "$GH_TOKEN" ]; then
      exec bun run dist/main.js start -g "$GH_TOKEN" "$@"
    else
      exec bun run dist/main.js start "$@"
    fi
    ;;
  console)
    shift
    exec bun run dist/main.js console "$@"
    ;;
  auth)
    exec bun run dist/main.js auth
    ;;
  *)
    # Unknown command, pass through to default (console)
    exec bun run dist/main.js console "$@"
    ;;
esac
