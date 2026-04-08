# Home Server Deployment Guide

## Prerequisites
- Docker + Docker Compose installed
- Ports 80 and 443 open on your router and forwarded to this machine
- A DuckDNS account and subdomain registered at https://www.duckdns.org

## First-Time Setup

### 1. Clone and configure
```bash
git clone <repo-url> /opt/creatorzone
cd /opt/creatorzone
cp backend/.env.production.example backend/.env
```

Edit `backend/.env` — fill in all `CHANGE_ME` values.

### 2. Generate JWT keys
```bash
mkdir -p backend/keys
cd backend/keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
cd ../..
```

### 3. Set DuckDNS IP (run once, then set up cron)
```bash
curl "https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip="
```

Auto-update every 5 minutes — add to crontab:
```bash
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip=" > /dev/null
```

### 4. Start the stack
```bash
docker compose up -d
```

Wait ~60 seconds for Caddy to obtain TLS certs from Let's Encrypt.

### 5. Verify
```bash
curl https://api.creatorzone.duckdns.org/health
# Expected: {"status":"ok","db":"ok","redis":"ok"}
```

### 6. Enable auto-start on reboot
```bash
sudo cp creatorzone.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable creatorzone
sudo systemctl start creatorzone
```

## Updating
```bash
cd /opt/creatorzone
git pull
docker compose up -d --build
```
The `migrate` service runs automatically and applies any new migrations.

## Seed dev user (first run only)
```bash
docker compose exec api python -m backend.seeds.dev_user
```
