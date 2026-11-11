#!/usr/bin/env bash
set -euo pipefail
root="$(pwd -P)"
for package in ${BETIK_DEV_PACKAGES:-Server Client}; do
  case "$package" in Server|Client) ;; *) echo 'Invalid development package.' >&2; exit 1 ;; esac
  (
    flock 9
    expected="$(sha256sum "$root/$package/package-lock.json" | cut -d' ' -f1)"
    marker="$root/$package/node_modules/.betik-lock"
    if [[ ! -f "$marker" || "$(cat "$marker")" != "$expected" ]]; then
      npm --prefix "$root/$package" ci --no-audit --no-fund
      printf '%s\n' "$expected" > "$marker"
    fi
  ) 9>"/home/node/.npm/betik-$package-install.lock"
done
exec "$@"
