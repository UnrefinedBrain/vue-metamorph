#!/usr/bin/env bash
set -euo pipefail

CLI=/downstream/packages/cli/dist/index.js
SMOKE=/smoke/init

pass() { echo "  PASS: $*"; }
fail() { echo "  FAIL: $*" >&2; exit 1; }

mkdir -p "$SMOKE"

echo "--- Running shadcn-vue init button --defaults --template vite"
node "$CLI" init button \
  --defaults \
  --template vite \
  --name app \
  --base-color neutral \
  --cwd "$SMOKE" \
  --yes \
  --silent

echo "Verifying scaffolded project:"

if [ ! -f "$SMOKE/app/package.json" ]; then
  echo "Contents of $SMOKE:"
  find "$SMOKE" -maxdepth 3 -type f | sort | sed 's/^/    /'
  fail "$SMOKE/app/package.json missing — init didn't scaffold the project"
fi
pass "scaffolded Vite project at \$SMOKE/app"

BUTTON=$(find "$SMOKE/app" -name 'Button.vue' | head -n 1 || true)
if [ -z "$BUTTON" ]; then
  echo "Vue files under $SMOKE/app:"
  find "$SMOKE/app" -name '*.vue' | sort | sed 's/^/    /'
  fail "Button.vue was not generated"
fi
pass "Button.vue generated at ${BUTTON#"$SMOKE/app"/}"
