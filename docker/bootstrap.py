#!/usr/bin/env python3
"""Create local-only Compose settings without copying any existing .env files."""
import os
from pathlib import Path
import secrets
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
check_only = "--check" in sys.argv
settings_keys = [
    "JWT_SECRET", "PRINT_SANDBOX_WEBHOOK_SECRET", "PRINT_ADDRESS_ENCRYPTION_KEY",
    "DEV_SEED_PASSWORD", "EMAIL_USER", "EMAIL_PASS", "CONTACT_EMAIL",
    "GOOGLE_CLIENT_ID", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_UPLOAD_PRESET",
    "DEV_EXTERNAL_INTEGRATIONS",
]
if any(key in os.environ for key in settings_keys):
    raise SystemExit("Unset exported application settings; Docker development reads only docker/.env.local.")
if str(root).startswith("/mnt/"):
    raise SystemExit("Use the Ubuntu Linux copy at ~/projects/Betik.")
if os.getuid() == 0:
    raise SystemExit("Run development commands as the normal WSL user.")
target = root / "docker/.env.local"
link = root / ".env"
if link.exists() or link.is_symlink():
    if not link.is_symlink() or link.readlink() != Path("docker/.env.local"):
        raise SystemExit("An unrelated root .env exists; it will not be read or overwritten.")
if not target.exists():
    if check_only:
        raise SystemExit("Run ./dev init first.")
    if subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
        raise SystemExit("Start local Docker Desktop before initialization.")
    volume = subprocess.run(["docker", "volume", "inspect", "betik-dev_mongo-data"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if volume.returncode == 0:
        raise SystemExit("Development data already exists. Restore its original docker/.env.local; keys will not be regenerated.")
    text = (root / "docker/.env.example").read_text()
    values = {
        "JWT_SECRET": secrets.token_hex(48),
        "PRINT_SANDBOX_WEBHOOK_SECRET": secrets.token_hex(32),
        "PRINT_ADDRESS_ENCRYPTION_KEY": secrets.token_hex(32),
        "DEV_SEED_PASSWORD": "Dev-" + secrets.token_hex(12),
    }
    for key, value in values.items():
        text = text.replace(key + "=\n", key + "=" + value + "\n")
    target.write_text(text)
    target.chmod(0o600)
if check_only and target.stat().st_mode & 0o077:
    raise SystemExit("Local settings must have 0600 permissions. Run ./dev init.")
if not check_only:
    metadata = {
        "BETIK_WORKSPACE_PATH": str(root),
        "LOCAL_UID": str(os.getuid()),
        "LOCAL_GID": str(os.getgid()),
        "DOCKER_GID": os.environ.get("DOCKER_GID", "1000"),
    }
    lines = target.read_text().splitlines()
    lines = [line for line in lines if line.split("=", 1)[0] not in metadata]
    lines.extend(key + "=" + value for key, value in metadata.items())
    target.write_text("\n".join(lines) + "\n")
    target.chmod(0o600)
    if not link.is_symlink():
        link.symlink_to("docker/.env.local")
print("Local Compose configuration ready. Secret values were not printed.")
