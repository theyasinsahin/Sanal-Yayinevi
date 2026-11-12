#!/usr/bin/env bash
set -euo pipefail
for attempt in $(seq 1 90); do
  if mongosh --host mongo:27017 --quiet --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1; then
    mongosh --host mongo:27017 --quiet --eval '
      try { rs.status(); }
      catch (error) {
        if (error.code !== 94) throw error;
        rs.initiate({_id:"rs0",members:[{_id:0,host:"mongo:27017"}]});
      }'
    exit 0
  fi
  sleep 1
done
echo 'Local MongoDB did not become ready.' >&2
exit 1
