#!/usr/bin/env python3.11
"""
Deploy Vygil AI (tar.gz) to Daytona sandbox with automatic fs/REST upload handling
"""
from daytona import Daytona, DaytonaConfig, Resources
from daytona.common.daytona import CreateSandboxFromImageParams
from pathlib import Path
import time
import os
import requests
import sys

# -----------------------------
# CONFIG
# -----------------------------
API_KEY = "dtn_17732aedf7bc385f3b3f5aa1fc04a002ee38cdc36786f0c0eb5dac5b77bd4efe"
OPENAI_KEY = "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"
TAR_FILE = Path("shop.tar.gz")
SANDBOX_NAME = "shop-ai-sandbox"

# -----------------------------
# Helper: Run command inside sandbox
# -----------------------------
def run(sb, cmd, timeout=None):
    code = f"""
import subprocess
result = subprocess.run({cmd!r}, shell=True, capture_output=True, text=True)
print(result.stdout if result.stdout else result.stderr, end='')
exit(result.returncode)
"""
    return sb.process.code_run(code, timeout=timeout)

# -----------------------------
# CREATE SANDBOX
# -----------------------------
print("\n🚀 Creating sandbox with Python 3.11 base image...\n")
dt = Daytona(DaytonaConfig(api_key=API_KEY))
params = CreateSandboxFromImageParams(
    name=SANDBOX_NAME,
    image="python:3.11-slim",
    public=True,
    resources=Resources(cpu=4, memory=5, disk=10),
)

sb = dt.create(params, timeout=180)
print(f"✅ Sandbox created: {sb.id} | State: {sb.state}\n")

# -----------------------------
# UPLOAD TAR.GZ (fs or REST fallback)
# -----------------------------
if not TAR_FILE.exists():
    sys.exit(f"❌ {TAR_FILE} not found! Place it in the same directory as this script.")

print(f"📤 Uploading {TAR_FILE.name} to sandbox...")

try:
    if hasattr(sb, "fs") and hasattr(sb.fs, "upload_file"):
        sb.fs.upload_file(str(TAR_FILE), f"/home/daytona/{TAR_FILE.name}")
        print("✅ Upload complete via sb.fs.upload_file()")
    else:
        # Fallback to REST upload
        upload_url = f"https://api.daytona.io/v1/sandboxes/{sb.id}/files/upload"
        headers = {"Authorization": f"Bearer {API_KEY}"}
        with open(TAR_FILE, "rb") as f:
            res = requests.post(upload_url, headers=headers, files={"file": (TAR_FILE.name, f)})
        if res.status_code != 200:
            raise RuntimeError(f"Upload failed: {res.status_code} - {res.text}")
        print("✅ Upload complete via REST API")
except Exception as e:
    sys.exit(f"❌ Upload failed: {e}")

print("🔧 Installing base tools (curl, unzip, tar)...\n")
run(sb, "apt-get update && apt-get install -y curl unzip tar")

print("📦 Extracting archive inside sandbox...")
run(sb, "cd /home/daytona")
run(sb, f"tar -xzf {TAR_FILE.name} && rm {TAR_FILE.name}")
print("✅ Repo extracted successfully!\n")

# -----------------------------
# INSTALL DEPENDENCIES
# -----------------------------
print("📥 Installing uv and Python deps...\n")
run(sb, "apt-get install -y python3-pip")
run(sb, "pip install uv")
run(sb, "apt-get update")
run(sb, "apt-get install -y curl")

run(sb, "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -")
run(sb, "apt-get install -y nodejs")
run(sb, "apt-get install -y npm")

run(sb, "source ~/.bashrc || true")
run(sb, "uv python install 3.11 || true")
run(sb, "cd ~/vygil-ai && uv sync || pip install -r requirements.txt || true")

# -----------------------------
# CREATE ENV FILE
# -----------------------------
print("\n⚙️  Creating .env.local...")
run(sb, f"echo 'OPENAI_API_KEY={OPENAI_KEY}' > ~/vygil-ai/.env.local")

# -----------------------------
# START APP
# -----------------------------
print("\n🚀 Starting Vygil AI services...\n")
run(sb, "cd ~/vygil-ai && chmod +x start-services.sh && ./start-services.sh || python3 app.py || true")

# -----------------------------
# GET PREVIEW LINKS
# -----------------------------
print("\n🌐 Checking for exposed ports...\n")
ports = [3000, 8000, 8501]
active_links = []
for port in ports:
    try:
        link = sb.get_preview_link(port)
        if link:
            active_links.append((port, link.url))
    except Exception:
        pass

print("\n" + "="*70)
print("✅ Vygil AI Sandbox is LIVE!")
print("="*70)
if active_links:
    for port, url in active_links:
        print(f"Port {port}: {url}")
else:
    print("No active ports detected yet — check Daytona dashboard.")
print("\nTo view logs inside sandbox:")
print("  tail -f /tmp/web.log  or  tail -f /tmp/app.log\n")
