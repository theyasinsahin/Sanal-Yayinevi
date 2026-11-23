#!/bin/sh
# make_env.sh <sandbox dir>: sandbox-only configuration with freshly generated secrets (mode 0600).
SB=$1; umask 077
cat > $SB/env.sh <<E
# Generated for the disposable sandbox. Nothing is copied from the project's .env files.
export NODE_ENV=development
export MONGO_URI='mongodb://127.0.0.1:27055/betik_stage2?replicaSet=rs0'
export JWT_SECRET=$(openssl rand -hex 48)
export CLIENT_URL=http://localhost:3055
export API_URL=http://localhost:5055
export PORT=5055
export REGISTRATION_GATE_ENABLED=true
export PRINT_SYSTEM_ENABLED=true
export PRINT_PAYMENTS_MODE=SANDBOX
export PRINT_SANDBOX_WEBHOOK_SECRET=$(openssl rand -hex 32)
export PRINT_ADDRESS_ENCRYPTION_KEY=$(openssl rand -hex 32)
export DEV_SEED_PASSWORD=Sb$(openssl rand -hex 8)Aa1!
export EMAIL_USER=noreply@betik-dev.invalid
export EMAIL_PASS=$(openssl rand -hex 8)
export CONTACT_EMAIL=contact@betik-dev.invalid
export SMTP_HOST=localhost
export SMTP_PORT=2555
export SMTP_SECURE=false
export NODE_EXTRA_CA_CERTS=$SB/data/tls/cert.pem
E
