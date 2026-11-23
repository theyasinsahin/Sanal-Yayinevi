# Verification sandbox (Stage 3 verification pass)

Scripts that rebuild the disposable test stack used by `Client/mobile/integration_test/v0*_test.dart`. No secrets are stored here; `make_env.sh` generates them. The stack is a copy of the repository's `Server/` run with an in-memory-style MongoDB, a local mail sink, and a host-side helper. Nothing in `Server/` or `Client/` (outside `Client/mobile/`) is modified.

| File | Role |
|---|---|
| `setup.sh <sandbox dir>` | Copies `Server/` (without `node_modules` and `.env*`), runs `npm ci` in the copy, installs the mail-sink packages, creates a self-signed certificate, writes `env.sh` (0600) with freshly generated secrets |
| `mongo.cjs` | MongoDB 8.0.34 single-node replica set on `127.0.0.1:27055` (mongodb-memory-server binary, data in the sandbox) |
| `smtp.cjs` | Mail sink on `127.0.0.1:2555`; stores every mail as JSON, relays nothing |
| `seed.mjs`, `seedclass.mjs`, `fixseed.mjs` | Same seed steps as Stage 2 (development seed, classification, draft-description repair); refuse any database other than the sandbox |
| `loopback.cjs` | `--require` preload that forces every listening socket of the API process onto `127.0.0.1` |
| `ctl.cjs` | Test helper on `127.0.0.1:5066`: mail lookup, read-only DB queries, rate-limit reset, two fixture resets, device screenshots, `adb input`, and a local stand-in for the Cloudinary unsigned-upload API |
| `start.sh <sandbox dir>` | Starts MongoDB, mail sink, seed (first run), API and helper |
| `drive.sh <ios|android> <suite>` | Runs one suite with the right `--dart-define`s |
