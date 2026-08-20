#!/usr/bin/env bash
set -euo pipefail

PINNED=$(node -p "(require('/downstream/package.json').packageManager || '')" 2>/dev/null || echo '')
case "$PINNED" in
  pnpm@*) PNPM_SPEC="${PINNED#pnpm@}"; PNPM_SPEC="${PNPM_SPEC%%+*}" ;;
  *) PNPM_SPEC="${PNPM_VERSION:-latest}" ;;
esac

echo "--- using pnpm@$PNPM_SPEC (repo pins: ${PINNED:-none})"
npm install --global --no-fund --no-audit "pnpm@$PNPM_SPEC"

pnpm install --no-frozen-lockfile --ignore-scripts
