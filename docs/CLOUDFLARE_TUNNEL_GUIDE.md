# Cloudflare Tunnel Guide for Home Servers

This guide explains how to use Cloudflare Tunnel to securely expose your Bike Power Tracker service running on a home computer to the internet.

## Table of Contents

1. [Why Cloudflare Tunnel?](#why-cloudflare-tunnel)
2. [Prerequisites](#prerequisites)
3. [How It Works](#how-it-works)
4. [Installation](#installation)
5. [Creating a Tunnel](#creating-a-tunnel)
6. [Configuration](#configuration)
7. [Running the Tunnel](#running-the-tunnel)
8. [Docker Integration](#docker-integration)
9. [Cloudflare Access (Authentication)](#cloudflare-access-authentication)
10. [Multiple Services](#multiple-services)
11. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
12. [Security Considerations](#security-considerations)

---

## Why Cloudflare Tunnel?

### The Problem with Traditional Port Forwarding

When running a server at home, you typically need to:
1. Configure port forwarding on your router
2. Deal with dynamic IP addresses (DDNS)
3. Expose your home IP to the internet
4. Manage SSL certificates manually
5. Hope your ISP doesn't block incoming ports

### How Cloudflare Tunnel Solves This

Cloudflare Tunnel creates an **outbound-only** connection from your home server to Cloudflare's network:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Home Network                           │
│                                                                 │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │ cloudflared │◄────►│   Nginx     │◄────►│   App       │     │
│  │   (tunnel)  │      │   :8080     │      │   :3000     │     │
│  └──────┬──────┘      └─────────────┘      └─────────────┘     │
│         │                                                       │
│         │ Outbound HTTPS (port 443)                            │
│         │ No incoming ports needed!                            │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Network                            │
│                                                                 │
│  • Free SSL/TLS certificates                                   │
│  • DDoS protection                                             │
│  • Global CDN edge locations                                   │
│  • Zero Trust access policies                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
    https://bike.yourdomain.com
    (Users connect here)
```

### Benefits

| Feature | Port Forwarding | Cloudflare Tunnel |
|---------|-----------------|-------------------|
| Open router ports | Required | Not needed |
| Exposes home IP | Yes | No |
| SSL certificates | Manual (Let's Encrypt) | Automatic |
| DDoS protection | None | Included |
| Works behind CGNAT | No | Yes |
| Dynamic IP handling | Needs DDNS | Automatic |
| Cost | Free | Free |

### When to Use Cloudflare Tunnel

✅ **Use it when:**
- You want to access your tracker while cycling outdoors
- You're behind CGNAT (Starlink, mobile hotspot, some ISPs)
- Your ISP blocks incoming ports
- You want SSL without managing certificates
- You want to share access with family/friends securely

❌ **Skip it when:**
- You only use the tracker on your home WiFi
- You have strict data locality requirements
- You need sub-millisecond latency (tunnel adds ~20-50ms)

---

## Prerequisites

### 1. A Domain Name

You need a domain name to use with Cloudflare. Options:

| Option | Cost | Notes |
|--------|------|-------|
| Cloudflare Registrar | $8-15/year | Cheapest for .com, .org, etc. |
| Namecheap, Porkbun | $8-15/year | Transfer to Cloudflare after |
| Freenom | Free | .tk, .ml domains (less reliable) |
| Already own one | - | Just add to Cloudflare |

### 2. Domain Added to Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click "Add a Site"
3. Enter your domain
4. Select Free plan
5. Update nameservers at your registrar (Cloudflare provides instructions)
6. Wait for DNS propagation (up to 24 hours, usually faster)

### 3. Bike Power Tracker Running Locally

Verify your service works locally before adding the tunnel:

```bash
curl http://localhost:8080/health
# Should return: {"status":"ok"}
```

---

## Installation

### Ubuntu/Debian (x86_64)

```bash
# Download and install
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb

# Verify
cloudflared --version
```

### Ubuntu/Debian (ARM64 - Raspberry Pi)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb
```

### Using Official Repository (Auto-updates)

```bash
# Add Cloudflare GPG key
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

# Add repository
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install
sudo apt update
sudo apt install cloudflared
```

### Fedora/RHEL

```bash
# Add repository
sudo tee /etc/yum.repos.d/cloudflared.repo << 'EOF'
[cloudflared]
name=cloudflared
baseurl=https://pkg.cloudflare.com/cloudflared/rpm
enabled=1
gpgcheck=1
gpgkey=https://pkg.cloudflare.com/cloudflare-main.gpg
EOF

sudo dnf install cloudflared
```

### Arch Linux

```bash
# From AUR
yay -S cloudflared-bin
```

---

## Creating a Tunnel

There are two ways to create tunnels:

### Method 1: CLI (Local Configuration)

Best for: Simple setups, full local control

```bash
# Step 1: Authenticate with Cloudflare
cloudflared tunnel login
# Opens browser - select your domain and authorize

# Step 2: Create the tunnel
cloudflared tunnel create bike-tracker
# Output: Created tunnel bike-tracker with id a1b2c3d4-...

# Step 3: Note your tunnel ID
cloudflared tunnel list
```

### Method 2: Dashboard (Remote Configuration)

Best for: Easy management, token-based setup

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Name it `bike-tracker`
5. Copy the tunnel token (starts with `eyJ...`)
6. Save token to your `.env` file:
   ```bash
   echo "CLOUDFLARE_TUNNEL_TOKEN=eyJ..." >> .env
   ```

---

## Configuration

### CLI Method: Config File

Create `~/.cloudflared/config.yml`:

```yaml
# Tunnel identification
tunnel: a1b2c3d4-e5f6-7890-abcd-ef1234567890  # Your tunnel ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json

# Service routing
ingress:
  # Bike Power Tracker API
  - hostname: bike-api.yourdomain.com
    service: http://localhost:8080
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true  # Local service uses HTTP
  
  # Optional: Serve client app too
  - hostname: bike.yourdomain.com
    service: http://localhost:8080
  
  # Required catch-all rule (must be last)
  - service: http_status:404
```

### Route DNS to Tunnel

```bash
# Create DNS record pointing to tunnel
cloudflared tunnel route dns bike-tracker bike-api.yourdomain.com

# Verify
cloudflared tunnel route dns bike-tracker bike-api.yourdomain.com
```

### Dashboard Method: Configure in UI

1. In Zero Trust Dashboard → Tunnels → your tunnel
2. Click **Configure**
3. Add public hostname:
   - Subdomain: `bike-api`
   - Domain: `yourdomain.com`
   - Service Type: `HTTP`
   - URL: `localhost:8080`
4. Save

---

## Running the Tunnel

### Manual Start (Testing)

```bash
# CLI config method
cloudflared tunnel run bike-tracker

# Token method
cloudflared tunnel run --token YOUR_TUNNEL_TOKEN
```

### As Systemd Service (Production)

```bash
# Install as system service
sudo cloudflared service install

# Or with token
sudo cloudflared service install --token YOUR_TUNNEL_TOKEN

# Enable and start
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

### As User Service (Rootless)

```bash
# Create user systemd directory
mkdir -p ~/.config/systemd/user

# Create service file
cat > ~/.config/systemd/user/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel run bike-tracker
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

# Enable lingering (run after logout)
sudo loginctl enable-linger $USER

# Enable and start
systemctl --user daemon-reload
systemctl --user enable cloudflared
systemctl --user start cloudflared
```

---

## Docker Integration

### Option 1: Separate Cloudflared Container

Add to your `docker-compose.home.yml`:

```yaml
services:
  # ... existing services (redis, app, nginx) ...

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: bike_tracker_tunnel
    restart: unless-stopped
    command: tunnel run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - backend
    depends_on:
      - nginx
    deploy:
      resources:
        limits:
          memory: 64M
```

Add token to `.env`:
```bash
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiYWJjMTIzLi4uIn0=
```

Start with tunnel:
```bash
docker compose -f docker-compose.home.yml up -d
```

### Option 2: Config File in Container

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: bike_tracker_tunnel
    restart: unless-stopped
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared:/etc/cloudflared:ro
    networks:
      - backend
```

Create `cloudflared/config.yml`:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: bike-api.yourdomain.com
    service: http://nginx:80
  - service: http_status:404
```

Copy credentials:
```bash
mkdir -p cloudflared
cp ~/.cloudflared/YOUR_TUNNEL_ID.json cloudflared/credentials.json
```

### Full Docker Compose with Cloudflare

Complete `docker-compose.cloudflare.yml`:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: bike_tracker_redis
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 30s
      timeout: 3s
      retries: 5
    networks:
      - backend
    restart: unless-stopped

  app:
    build:
      context: .
      target: production
    container_name: bike_tracker_service
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - CORS_ORIGIN=${CORS_ORIGIN}
      - API_KEY=${API_KEY:-}
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: bike_tracker_nginx
    # No ports exposed! Cloudflare handles external access
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
    networks:
      - backend
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: bike_tracker_tunnel
    command: tunnel run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - backend
    depends_on:
      - nginx
    restart: unless-stopped

volumes:
  redis_data:

networks:
  backend:
```

**Note:** With Cloudflare Tunnel, you don't need to expose any ports! The `ports:` section is removed from nginx.

---

## Cloudflare Access (Authentication)

Add authentication to protect your API from unauthorized access.

### Setting Up Access

1. Go to [Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Navigate to **Access** → **Applications**
3. Click **Add an application**
4. Select **Self-hosted**

### Configure Application

```
Application name: Bike Power Tracker
Session duration: 24 hours
Application domain: bike-api.yourdomain.com
```

### Add Access Policy

Create a policy to control who can access:

**Option 1: Email Allowlist**
```
Policy name: Allowed Users
Action: Allow
Include:
  - Emails: you@email.com, family@email.com
```

**Option 2: One-Time PIN (Email verification)**
```
Policy name: Email Verification  
Action: Allow
Include:
  - Emails ending in: @yourdomain.com
  - Everyone (with email verification)
```

**Option 3: GitHub/Google Login**
```
Policy name: OAuth Login
Action: Allow
Include:
  - Login Methods: GitHub, Google
```

### Bypass for Health Checks

If your monitoring needs unauthenticated access to `/health`:

1. In application settings, add **Bypass** policy
2. Configure:
   ```
   Policy name: Health Check Bypass
   Action: Bypass
   Include:
     - Path: /health
   ```

### Service Token for Automation

For automated clients (scripts, CI/CD):

1. Go to **Access** → **Service Auth**
2. Create service token
3. Use in requests:
   ```bash
   curl -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
        -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
        https://bike-api.yourdomain.com/api/streams
   ```

---

## Multiple Services

You can expose multiple services through one tunnel.

### Example: API + Client App + Grafana

```yaml
# ~/.cloudflared/config.yml
tunnel: a1b2c3d4-...
credentials-file: /home/user/.cloudflared/a1b2c3d4-....json

ingress:
  # API backend
  - hostname: bike-api.yourdomain.com
    service: http://localhost:8080
  
  # Client app (if self-hosted)
  - hostname: bike.yourdomain.com
    service: http://localhost:3000
  
  # Monitoring dashboard
  - hostname: grafana.yourdomain.com
    service: http://localhost:3001
    originRequest:
      noTLSVerify: true
  
  # SSH access (advanced)
  - hostname: ssh.yourdomain.com
    service: ssh://localhost:22
  
  # Catch-all
  - service: http_status:404
```

Route all DNS:
```bash
cloudflared tunnel route dns bike-tracker bike-api.yourdomain.com
cloudflared tunnel route dns bike-tracker bike.yourdomain.com
cloudflared tunnel route dns bike-tracker grafana.yourdomain.com
```

---

## Monitoring & Troubleshooting

### Check Tunnel Status

```bash
# List tunnels
cloudflared tunnel list

# Tunnel info
cloudflared tunnel info bike-tracker

# Active connections
cloudflared tunnel info bike-tracker | grep -A5 "Connections"
```

### View Logs

```bash
# Systemd service logs
sudo journalctl -u cloudflared -f

# Docker container logs
docker logs -f bike_tracker_tunnel

# Debug mode
cloudflared tunnel --loglevel debug run bike-tracker
```

### Test Connectivity

```bash
# 1. Test local service first
curl http://localhost:8080/health

# 2. Test via tunnel (from any network)
curl https://bike-api.yourdomain.com/health

# 3. Check DNS resolution
dig bike-api.yourdomain.com

# 4. Test with verbose output
curl -v https://bike-api.yourdomain.com/health
```

### Common Issues

#### Tunnel not connecting

```bash
# Check credentials file exists
ls -la ~/.cloudflared/

# Re-authenticate
cloudflared tunnel login

# Recreate tunnel if needed
cloudflared tunnel delete bike-tracker
cloudflared tunnel create bike-tracker
```

#### 502 Bad Gateway

The tunnel connects but can't reach your service:

```bash
# Check service is running
curl http://localhost:8080/health

# Check correct port in config
# Make sure ingress service URL is correct

# Docker: check network connectivity
docker exec bike_tracker_tunnel wget -O- http://nginx:80/health
```

#### DNS not resolving

```bash
# Check CNAME record exists
dig +short bike-api.yourdomain.com

# Should show: <tunnel-id>.cfargotunnel.com

# If missing, re-add route
cloudflared tunnel route dns bike-tracker bike-api.yourdomain.com
```

#### Cloudflare Access blocking requests

```bash
# Check if Access is enabled
# Response header will show: cf-access-authenticated

# Create bypass policy for paths that need public access
# Or use service tokens for automation
```

### Metrics & Monitoring

Enable Prometheus metrics:

```yaml
# In config.yml
metrics: localhost:2000
```

Access at `http://localhost:2000/metrics`

---

## Security Considerations

### 1. Use API Key Authentication

Even with Cloudflare Access, add API key as defense in depth:

```bash
# In .env
API_KEY=$(openssl rand -hex 32)
```

### 2. Restrict CORS

```bash
# Only allow your domain
CORS_ORIGIN=https://bike.yourdomain.com
```

### 3. Enable Cloudflare WAF (Optional)

In Cloudflare Dashboard → Security → WAF:
- Enable managed rules
- Add rate limiting rules

### 4. Monitor Access Logs

In Zero Trust Dashboard → Logs → Access:
- Review authentication attempts
- Set up alerts for suspicious activity

### 5. Rotate Tunnel Credentials

Periodically rotate tunnel:

```bash
# Delete old tunnel
cloudflared tunnel delete bike-tracker

# Create new one
cloudflared tunnel create bike-tracker

# Update config and restart
```

### 6. Keep Cloudflared Updated

```bash
# If installed via apt
sudo apt update && sudo apt upgrade cloudflared

# If using Docker, pull latest
docker pull cloudflare/cloudflared:latest
docker compose -f docker-compose.home.yml up -d cloudflared
```

---

## Quick Reference

### Commands

| Task | Command |
|------|---------|
| Install tunnel | `cloudflared tunnel login && cloudflared tunnel create bike-tracker` |
| Start tunnel | `cloudflared tunnel run bike-tracker` |
| List tunnels | `cloudflared tunnel list` |
| Tunnel info | `cloudflared tunnel info bike-tracker` |
| Add DNS route | `cloudflared tunnel route dns bike-tracker subdomain.domain.com` |
| Delete tunnel | `cloudflared tunnel delete bike-tracker` |
| View logs | `sudo journalctl -u cloudflared -f` |

### Files

| File | Purpose |
|------|---------|
| `~/.cloudflared/config.yml` | Tunnel configuration |
| `~/.cloudflared/<tunnel-id>.json` | Tunnel credentials |
| `/etc/systemd/system/cloudflared.service` | System service (root) |
| `~/.config/systemd/user/cloudflared.service` | User service (rootless) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_TUNNEL_TOKEN` | Token for Docker/remote config |
| `TUNNEL_TOKEN` | Alternative token variable |
| `TUNNEL_LOGLEVEL` | Log level (debug, info, warn, error) |

---

## Further Reading

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Zero Trust Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Cloudflared GitHub](https://github.com/cloudflare/cloudflared)
- [Home Deployment Guide](HOME_DEPLOYMENT.md) - Main deployment documentation
