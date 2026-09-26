#!/usr/bin/env bash
# Enforces a minimum statement coverage over internal/modules/... (domain +
# usecase + adapters), the Go equivalent of the TS kit's vitest coverage
# thresholds. internal/platform/... and cmd/... are wiring/bootstrap code,
# excluded the same way the TS kit excludes container.ts, main.ts and the
# Prisma/Redis clients from its coverage config.
set -euo pipefail

THRESHOLD="${1:-80}"
PROFILE="${2:-coverage.out}"

total=$(go tool cover -func="$PROFILE" | tail -1 | awk '{print $3}' | tr -d '%')

echo "Total coverage (internal/modules/...): ${total}%"

# Bash has no float comparison; awk does the "< threshold" check.
if awk -v t="$total" -v m="$THRESHOLD" 'BEGIN { exit !(t < m) }'; then
  echo "FAIL: coverage ${total}% is below the ${THRESHOLD}% threshold"
  exit 1
fi

echo "OK: coverage ${total}% meets the ${THRESHOLD}% threshold"
