#!/usr/bin/env bash
set -euo pipefail

pnpm rebuild

if [ -n "$BUILD_CMD" ]; then
  eval "$BUILD_CMD"
fi

eval "$TEST_CMD"
