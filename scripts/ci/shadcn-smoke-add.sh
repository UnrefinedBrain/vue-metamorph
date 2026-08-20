#!/usr/bin/env bash
set -euo pipefail

CLI=/downstream/packages/cli/dist/index.js
SMOKE=/smoke/add

pass() { echo "  PASS: $*"; }
fail() { echo "  FAIL: $*" >&2; exit 1; }

echo "--- Setting up fixture project at $SMOKE"
mkdir -p "$SMOKE/src"
: > "$SMOKE/src/index.css"
cat > "$SMOKE/package.json" <<'JSON'
{
  "name": "smoke",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "packageManager": "pnpm@10.25.0"
}
JSON
cat > "$SMOKE/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "~/*": ["./src/*"] }
  }
}
JSON
cat > "$SMOKE/components.json" <<'JSON'
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "new-york",
  "typescript": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "~/components",
    "utils": "~/lib/utils",
    "ui": "~/components/ui",
    "lib": "~/lib",
    "composables": "~/composables"
  },
  "iconLibrary": "lucide"
}
JSON
echo "Created fixture files:"
( cd "$SMOKE" && find . -type f | sort | sed 's/^/  /' )

echo "--- Running shadcn-vue add button"
echo "\$ node $CLI add button --cwd $SMOKE --yes --silent"
node "$CLI" add button --cwd "$SMOKE" --yes --silent

echo "Verifying generated output:"

BUTTON=$(find "$SMOKE" -name 'Button.vue' | head -n 1 || true)
if [ -z "$BUTTON" ]; then
  echo "Files under $SMOKE after add:"
  find "$SMOKE" -type f | sort | sed 's/^/    /'
  fail "Button.vue was not generated"
fi
pass "Button.vue generated at ${BUTTON#"$SMOKE"/}"

# Verify transformImport actually rewrote @/-aliased imports to our
# custom utils alias (quote style varies by registry source).
UTILS_FILE=$(grep -rlE "from ['\"]~/lib/utils['\"]" "$SMOKE" | head -n 1 || true)
if [ -z "$UTILS_FILE" ]; then
  echo "Imports of *utils* found in generated files:"
  grep -rnE "from ['\"][^'\"]*utils[^'\"]*['\"]" "$SMOKE" | sed 's/^/    /' || true
  fail "expected vue-metamorph to rewrite utils import to ~/lib/utils"
fi
pass "utils alias rewritten to ~/lib/utils (in ${UTILS_FILE#"$SMOKE"/})"

echo "--- Generated $(basename "$BUTTON")"
cat "$BUTTON"
