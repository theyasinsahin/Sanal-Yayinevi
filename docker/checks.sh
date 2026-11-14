#!/usr/bin/env bash
set -euo pipefail
cd /workspace
test "$(node --version)" = v26.13.0
test "$(npm --version)" = 11.13.0
test ! -e Server/.env
test ! -e Server/.env.prod
test ! -e Client/.env
test ! -e .env
test ! -e docker/.env.local
test ! -S /var/run/docker.sock
mkdir -p /artifacts
target="${1:-unit}"
if [[ $# -gt 0 ]]; then shift; fi
case "$target" in
  lint)
    npm --prefix Server run lint
    npm --prefix Client run lint
    ;;
  server) npm --prefix Server run test:ci -- "$@" ;;
  fresh)
    # Real ephemeral replica-set workflow: bootstrap -> options -> book -> chapter -> publication.
    # No development volume or real email/provider is used.
    npm --prefix Server run test:ci -- --runTestsByPath tests/developmentSeed.test.js tests/classification.test.js tests/dockerDevelopment.test.js tests/developmentRegistration.test.js "$@"
    ;;
  client) npm --prefix Client run test:ci -- "$@" ;;
  unit)
    npm --prefix Server run lint
    npm --prefix Client run lint
    npm --prefix Server run test:ci
    npm --prefix Client run test:ci
    ;;
  browser)
    # Only build warnings are non-fatal; the separate lint step still fails errors.
    CI=false npm --prefix Client run build
    npm --prefix Client run test:google-callback-build
    PLAYWRIGHT_HTML_OUTPUT_DIR=/artifacts/playwright-report \
      npm --prefix Client run test:e2e -- --output=/artifacts/test-results "$@"
    ;;
  *) echo 'Unknown check target.' >&2; exit 2 ;;
esac
