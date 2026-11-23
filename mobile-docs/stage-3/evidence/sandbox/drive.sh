#!/bin/sh
# drive.sh <ios|android> <suite basename, e.g. v07_commerce> : runs one on-device suite against the sandbox.
# Needs the variables from the sandbox env helper (S, SB, MOB, DEV_SEED_PASSWORD, IOS_UDID, PATH with flutter/adb).
P=$1; T=$2
if [ "$P" = ios ]; then D=$IOS_UDID; else D=emulator-5554; adb reverse tcp:5055 tcp:5055 >/dev/null; adb reverse tcp:5066 tcp:5066 >/dev/null; fi
START=$(date -u +%Y-%m-%dT%H:%M:%S)
curl -s localhost:5066/ratereset -d '{}' >/dev/null
mkdir -p $S/runs; cd $MOB
flutter drive --driver=test_driver/integration_test.dart --target=integration_test/${T}_test.dart -d $D \
  --dart-define=BETIK_API_URL=http://localhost:5055 --dart-define=BETIK_WEB_URL=http://localhost:3055 \
  --dart-define=BETIK_TEST_PASSWORD=$DEV_SEED_PASSWORD --dart-define=BETIK_TEST_CTL=http://localhost:5066 \
  --dart-define=BETIK_CLOUDINARY_CLOUD_NAME=betik-sandbox --dart-define=BETIK_CLOUDINARY_UPLOAD_PRESET=betik-sandbox-preset \
  --dart-define=BETIK_CLOUDINARY_API_BASE=http://localhost:5066 > $S/runs/${P}_${T}.log 2>&1
echo "exit=$?"
python3 - "$P" "$START" "$SB/logs/scenarios.jsonl" <<'PY'
import json,sys
p,start,f=sys.argv[1:4]
n=ok=0
for l in open(f):
    r=json.loads(l)
    if r['at']<start or r['platform']!=p or 'ok' not in r: continue
    n+=1; ok+=r['ok']
    st='SKIP' if r.get('skipped') else ('PASS' if r['ok'] else 'FAIL')
    print(st, r['id'], '|', r['name'], ('| '+(r['detail'] or '')[:900]) if st!='PASS' else '')
print(f'{ok}/{n} passed')
PY
