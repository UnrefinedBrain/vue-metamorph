#!/usr/bin/env bash
set -euo pipefail

NETWORK_MODE=$1
ENTRYPOINT=$(realpath "$2")
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

ALLOWED_HOSTS=${ALLOWED_HOSTS:-'.npmjs.org,.npmjs.com,.shadcn-vue.com,shadcn-vue.com,.github.com,github.com,.githubusercontent.com,.jsdelivr.net,.unpkg.com'}

RUN_ID="vm-sandbox-$$"
NET_INTERNAL="$RUN_ID-internal"
NET_EGRESS="$RUN_ID-egress"
PROXY="$RUN_ID-proxy"

cleanup() {
  if [ "$NETWORK_MODE" = 'proxied' ]; then
    docker rm --force "$PROXY" >/dev/null 2>&1 || true
    docker network rm "$NET_INTERNAL" "$NET_EGRESS" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

NETWORK_ARGS=(--network none)
[ "$NETWORK_MODE" = 'open' ] && NETWORK_ARGS=(--network bridge)

if [ "$NETWORK_MODE" = 'proxied' ]; then
  # --internal leaves no route off the host, so the sandbox can't reach the
  # internet even with its own DNS server. The proxy bridges to a second network.
  docker network create --internal "$NET_INTERNAL" >/dev/null
  docker network create "$NET_EGRESS" >/dev/null

  docker run --detach --name "$PROXY" \
    --network "$NET_EGRESS" \
    --user "$(id -u):$(id -g)" \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --volume "$HERE/allowlist-proxy.mjs:/proxy.mjs:ro" \
    --env "ALLOWED_HOSTS=$ALLOWED_HOSTS" \
    "$NODE_IMAGE" \
    node /proxy.mjs >/dev/null
  docker network connect --alias proxy "$NET_INTERNAL" "$PROXY"

  NETWORK_ARGS=(
    --network "$NET_INTERNAL"
    --env HTTP_PROXY=http://proxy:3128
    --env HTTPS_PROXY=http://proxy:3128
    # Uppercase only: shadcn-vue's CLI builds an undici ProxyAgent from a
    # lowercase https_proxy and hands it to Node's global fetch, which rejects a
    # foreign dispatcher. Leaving the lowercase names unset keeps that dormant.
    --env NODE_USE_ENV_PROXY=1
    --env npm_config_proxy=http://proxy:3128
    --env npm_config_https_proxy=http://proxy:3128
  )
fi

# Untrusted output is step output, and the runner parses `::commands::` out of it.
TOKEN="untrusted-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
echo "::stop-commands::${TOKEN}"

set +e
docker run --rm \
  "${NETWORK_ARGS[@]}" \
  --user "$(id -u):$(id -g)" \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --workdir /downstream \
  --volume "$DOWNSTREAM:/downstream" \
  --volume "$TARBALL_DIR:/tarball:ro" \
  --volume "$SANDBOX_HOME:/sandbox-home" \
  --volume "$SMOKE_DIR:/smoke" \
  --volume "$ENTRYPOINT:/sandbox-entrypoint.sh:ro" \
  --env CI=true \
  --env HOME=/sandbox-home \
  --env PNPM_HOME=/sandbox-home/.pnpm \
  --env npm_config_prefix=/sandbox-home/.npm-global \
  --env PATH=/sandbox-home/.pnpm:/sandbox-home/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  --env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  --env "PNPM_VERSION=${PNPM_VERSION:-}" \
  --env "BUILD_CMD=${BUILD_CMD:-}" \
  --env "TEST_CMD=${TEST_CMD:-}" \
  "$NODE_IMAGE" \
  bash /sandbox-entrypoint.sh
STATUS=$?
set -e

# The proxy log names hosts the untrusted code chose, so it belongs inside the
# fence too.
if [ "$NETWORK_MODE" = 'proxied' ]; then
  echo "--- egress proxy log ---"
  docker logs "$PROXY" 2>&1 | sed 's/^/  /' || true
fi

echo "::${TOKEN}::"
exit "$STATUS"
