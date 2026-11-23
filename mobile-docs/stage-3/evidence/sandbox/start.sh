#!/bin/sh
# start.sh <sandbox dir>: start MongoDB, mail sink, (first run: seed), API on loopback, test helper.
SB=$1; . $SB/env.sh; cd $SB
(nohup node tools/mongo.cjs > logs/mongo.log 2>&1 &); (nohup node tools/smtp.cjs > logs/smtp.log 2>&1 &)
for i in $(seq 1 120); do grep -q MONGO_READY logs/mongo.log && break; sleep 2; done
if [ ! -f data/.seeded ]; then
  node tools/seed.mjs && node tools/seedclass.mjs && (cd app/Server && node src/scripts/seedBadges.js) && node tools/fixseed.mjs && touch data/.seeded
fi
(cd app/Server && NODE_OPTIONS="--require $SB/tools/loopback.cjs" nohup node index.js > $SB/logs/api.log 2>&1 &)
(EV_DIR=$EV_DIR IOS_UDID=$IOS_UDID nohup node tools/ctl.cjs > logs/ctl.log 2>&1 &)
sleep 8; netstat -anp tcp | grep LISTEN | grep -E "\.(5055|27055|2555|5066) "
