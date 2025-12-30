# Home Server Deployment Guide

This guide describes how to deploy the Bike Power Tracker Service on a home computer using Docker or Podman, with optional Cloudflare Tunnel for secure remote access.

## Quick Start with Scripts

For automated setup, use the deployment scripts in [home-deployment-scripts/](home-deployment-scripts/):

```bash
cd docs/home-deployment-scripts
chmod +x *.sh

# Run setup wizard
./setup.sh

# Start services
./start.sh

# Check health
./health-check.sh --verbose
```

See the [scripts README](home-deployment-scripts/README.md) for full documentation.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Docker Deployment](#docker-deployment)
5. [Podman Deployment](#podman-deployment)
6. [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
7. [Security Best Practices](#security-best-practices)
8. [Network Configuration](#network-configuration)
9. [Maintenance & Operations](#maintenance--operations)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Running the Bike Power Tracker on a home server offers several advantages:
- **No monthly hosting costs** – Use hardware you already own
- **Full control** – Complete access to logs, data, and configuration
- **Privacy** – Your data stays on your network
- **Low latency** – Direct connection when on your home network

### Use Cases

| Scenario | Recommended Setup |
|----------|-------------------|
| Local network only | Docker/Podman with local access |
| Access from mobile while cycling | Cloudflare Tunnel (no port forwarding) |
| Share with family/friends | Cloudflare Tunnel with Access policies |

---

## Prerequisites

### Hardware Requirements

- **Minimum**: Any x86_64 or ARM64 computer (Raspberry Pi 4+, old laptop, NUC, etc.)
- **RAM**: 512MB+ available for containers
- **Storage**: 1GB+ free space
- **Network**: Ethernet recommended for reliability

### Software Requirements

Choose **one** container runtime:

**Docker (recommended for beginners):**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in

# Verify installation
docker --version
docker compose version
```

**Podman (rootless, no daemon):**
```bash
# Ubuntu 22.04+
sudo apt install podman podman-compose

# Fedora
sudo dnf install podman podman-compose

# Verify installation
podman --version
podman-compose --version
```

---

## Architecture

### Local Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                    Home Computer                            │
│  ┌─────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │  Nginx  │──────│   Node.js   │──────│    Redis    │     │
│  │  :8080  │      │   App:3000  │      │    :6379    │     │
│  └─────────┘      └─────────────┘      └─────────────┘     │
│       ▲                                                     │
└───────│─────────────────────────────────────────────────────┘
        │
   Home Network (192.168.x.x)
```

### With Cloudflare Tunnel (Recommended for Remote Access)

```
┌──────────────────────────────────────────────────────────────────┐
│                       Home Computer                              │
│  ┌──────────┐   ┌─────────┐   ┌─────────┐   ┌─────────────┐     │
│  │Cloudflare│───│  Nginx  │───│ Node.js │───│    Redis    │     │
│  │  Tunnel  │   │  :8080  │   │  :3000  │   │    :6379    │     │
│  └──────────┘   └─────────┘   └─────────┘   └─────────────┘     │
│       ▲                                                          │
└───────│──────────────────────────────────────────────────────────┘
        │ Outbound connection (no open ports)
        ▼
┌─────────────────┐
│   Cloudflare    │◄──── https://bike.yourdomain.com
│     Network     │
└─────────────────┘
```

**Why Cloudflare Tunnel?**
- ✅ No port forwarding required
- ✅ Free SSL/TLS certificates
- ✅ DDoS protection
- ✅ Works behind CGNAT (Starlink, mobile carriers)
- ✅ No exposed home IP address

---

## Docker Deployment

### Step 1: Get the Service Files

```bash
# Clone the repository (or copy the service directory)
git clone https://github.com/yourusername/bike-power-tracker.git
cd bike-power-tracker/packages/service
```

### Step 2: Create Environment File

```bash
# Generate a secure .env file
cat > .env << 'EOF'
# Redis Configuration
REDIS_PASSWORD=$(openssl rand -base64 32)

# CORS - Set to your client URL or * for development
CORS_ORIGIN=*

# Optional API Key (recommended for remote access)
# API_KEY=your-secure-api-key-here
EOF

# Generate actual random password
sed -i "s|\$(openssl rand -base64 32)|$(openssl rand -base64 32)|" .env

# Verify
cat .env
```

### Step 3: Create Home-Optimized Docker Compose

Create `docker-compose.home.yml`:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: bike_tracker_redis
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes --maxmemory 100mb --maxmemory-policy allkeys-lru
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
    # Resource limits for home server
    deploy:
      resources:
        limits:
          memory: 128M

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: bike_tracker_service
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - CORS_ORIGIN=${CORS_ORIGIN:-*}
      - API_KEY=${API_KEY:-}
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  nginx:
    image: nginx:alpine
    container_name: bike_tracker_nginx
    ports:
      - "8080:80"  # Use 8080 to avoid conflicts with other services
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 64M

volumes:
  redis_data:

networks:
  backend:
```

### Step 4: Start the Services

```bash
# Build and start
docker compose -f docker-compose.home.yml up -d --build

# Check status
docker compose -f docker-compose.home.yml ps

# View logs
docker compose -f docker-compose.home.yml logs -f
```

### Step 5: Verify Deployment

```bash
# Health check
curl http://localhost:8080/health
# Expected: {"status":"ok"}

# API test
curl http://localhost:8080/api/streams
# Expected: {"streams":[]}
```

---

## Podman Deployment

Podman is a rootless, daemonless alternative to Docker. It's more secure for home servers as it doesn't require root privileges.

### Step 1: Enable Lingering (for services to run after logout)

```bash
# Allow your user's services to run without being logged in
sudo loginctl enable-linger $USER
```

### Step 2: Create Pod and Services

```bash
cd bike-power-tracker/packages/service

# Create .env file (same as Docker step)
# ... (see Docker Step 2)

# Create a pod (similar to docker-compose network)
podman pod create --name bike-tracker -p 8080:80

# Start Redis
podman run -d \
  --pod bike-tracker \
  --name bike_tracker_redis \
  -e REDIS_PASSWORD="$(grep REDIS_PASSWORD .env | cut -d= -f2)" \
  -v bike_redis_data:/data:Z \
  redis:7-alpine \
  redis-server --requirepass "$(grep REDIS_PASSWORD .env | cut -d= -f2)" --appendonly yes

# Build and start the app
podman build -t bike-tracker-app --target production .
podman run -d \
  --pod bike-tracker \
  --name bike_tracker_service \
  -e NODE_ENV=production \
  -e REDIS_HOST=localhost \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD="$(grep REDIS_PASSWORD .env | cut -d= -f2)" \
  -e CORS_ORIGIN="*" \
  bike-tracker-app

# Start Nginx
podman run -d \
  --pod bike-tracker \
  --name bike_tracker_nginx \
  -v ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro,Z \
  nginx:alpine
```

### Alternative: Use Podman Compose

```bash
# podman-compose works with standard docker-compose files
podman-compose -f docker-compose.home.yml up -d
```

### Create Systemd Service (Auto-start on Boot)

```bash
# Generate systemd unit files
mkdir -p ~/.config/systemd/user
podman generate systemd --new --name bike-tracker > ~/.config/systemd/user/bike-tracker.service

# Enable and start
systemctl --user daemon-reload
systemctl --user enable bike-tracker.service
systemctl --user start bike-tracker.service

# Check status
systemctl --user status bike-tracker.service
```

---

## Cloudflare Tunnel Setup

Cloudflare Tunnel provides secure remote access without opening ports on your router.

> 📖 **For comprehensive Cloudflare setup instructions, see [CLOUDFLARE_TUNNEL_GUIDE.md](CLOUDFLARE_TUNNEL_GUIDE.md)**

### Quick Start

1. A domain name (can be free from Freenom or cheap from Cloudflare Registrar)
2. Domain added to Cloudflare (free tier works)
3. Cloudflare account

### Step 1: Install Cloudflared

```bash
# Ubuntu/Debian
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Or using the official repository
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# ARM64 (Raspberry Pi)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### Step 2: Authenticate with Cloudflare

```bash
cloudflared tunnel login
# Opens browser - select your domain
```

### Step 3: Create Tunnel

```bash
# Create a tunnel
cloudflared tunnel create bike-tracker

# Note the tunnel ID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890)
```

### Step 4: Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: a1b2c3d4-e5f6-7890-abcd-ef1234567890  # Your tunnel ID
credentials-file: /home/YOUR_USER/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json

ingress:
  # Main API service
  - hostname: bike-api.yourdomain.com
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
  
  # Catch-all (required)
  - service: http_status:404
```

### Step 5: Route DNS

```bash
# Create DNS record pointing to tunnel
cloudflared tunnel route dns bike-tracker bike-api.yourdomain.com
```

### Step 6: Run as Service

```bash
# Install as system service
sudo cloudflared service install

# Start the service
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared
```

### Step 7: Update Client Configuration

Build your client with the Cloudflare URL:

```bash
cd packages/client
VITE_API_URL=https://bike-api.yourdomain.com pnpm build
```

### Docker Compose with Cloudflared

Add cloudflared to your compose file:

```yaml
# Add to docker-compose.home.yml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: bike_tracker_tunnel
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - backend
    restart: unless-stopped
    depends_on:
      - nginx
```

Get tunnel token from Cloudflare Zero Trust dashboard → Networks → Tunnels → Configure.

---

## Security Best Practices

### 1. Enable API Key Authentication

```bash
# Generate a secure API key
API_KEY=$(openssl rand -hex 32)
echo "API_KEY=$API_KEY" >> .env

# Restart services
docker compose -f docker-compose.home.yml restart
```

### 2. Restrict CORS Origins

```bash
# In .env - only allow your specific domain
CORS_ORIGIN=https://bike-api.yourdomain.com
```

### 3. Keep Containers Updated

```bash
# Update base images regularly
docker compose -f docker-compose.home.yml pull
docker compose -f docker-compose.home.yml up -d --build
```

### 4. Use Cloudflare Access (Optional)

Add authentication via Cloudflare Zero Trust:

1. Go to Cloudflare Zero Trust dashboard
2. Access → Applications → Add Application
3. Select "Self-hosted"
4. Configure:
   - Application domain: `bike-api.yourdomain.com`
   - Session duration: 24 hours
5. Add policy (email, one-time PIN, etc.)

### 5. Firewall Configuration

If not using Cloudflare Tunnel, configure firewall:

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw allow ssh
sudo ufw allow from 192.168.0.0/16 to any port 8080  # Local network only
sudo ufw enable

# Or with firewalld (Fedora)
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.0.0/16" port port="8080" protocol="tcp" accept'
sudo firewall-cmd --reload
```

### 6. Regular Backups

```bash
# Create backup script
cat > ~/backup-bike-tracker.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups/bike-tracker
mkdir -p $BACKUP_DIR
docker exec bike_tracker_redis redis-cli -a "$REDIS_PASSWORD" BGSAVE
sleep 2
docker cp bike_tracker_redis:/data/dump.rdb "$BACKUP_DIR/redis-$(date +%Y%m%d-%H%M%S).rdb"
# Keep only last 7 backups
ls -t $BACKUP_DIR/*.rdb | tail -n +8 | xargs -r rm
EOF
chmod +x ~/backup-bike-tracker.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-bike-tracker.sh") | crontab -
```

---

## Network Configuration

### Finding Your Server's IP

```bash
# Get local IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# Or
hostname -I
```

### Static IP (Recommended)

Configure a static IP in your router's DHCP settings to ensure consistent access.

### Local DNS (Optional)

Add entry to devices or use Pi-hole/AdGuard:

```bash
# /etc/hosts on client devices
192.168.1.100  bike-tracker.local
```

### mDNS/Avahi (Linux/Mac)

```bash
# Install avahi
sudo apt install avahi-daemon

# Access via: http://your-hostname.local:8080
```

---

## Maintenance & Operations

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.home.yml logs -f

# Specific service with timestamps
docker compose -f docker-compose.home.yml logs -f --timestamps app

# Last 100 lines
docker compose -f docker-compose.home.yml logs --tail=100
```

### Monitoring Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

### Cleanup

```bash
# Remove unused images and containers
docker system prune -a

# Remove unused volumes (careful - may delete data!)
docker volume prune
```

### Updating

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.home.yml up -d --build

# Or use the deploy script
./deploy.sh
```

### Health Monitoring Script

```bash
cat > ~/check-bike-tracker.sh << 'EOF'
#!/bin/bash
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
if [ "$HEALTH" != "200" ]; then
  echo "$(date): Health check failed with status $HEALTH" >> ~/bike-tracker-health.log
  docker compose -f ~/bike-power-tracker/packages/service/docker-compose.home.yml restart
fi
EOF
chmod +x ~/check-bike-tracker.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/check-bike-tracker.sh") | crontab -
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.home.yml logs

# Check if port is in use
sudo lsof -i :8080

# Try different port
# Edit docker-compose.home.yml: ports: "8081:80"
```

### Redis Connection Failed

```bash
# Check Redis is running
docker exec bike_tracker_redis redis-cli -a "$REDIS_PASSWORD" ping

# Check environment variable
docker exec bike_tracker_service env | grep REDIS
```

### Cloudflare Tunnel Issues

```bash
# Check tunnel status
cloudflared tunnel info bike-tracker

# View tunnel logs
sudo journalctl -u cloudflared -f

# Test local connectivity first
curl http://localhost:8080/health
```

### Podman Permission Issues

```bash
# Reset storage
podman system reset

# Check SELinux (if applicable)
sudo ausearch -m AVC -ts recent

# Use :Z suffix for volumes on SELinux systems
-v ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro,Z
```

### Memory Issues on Low-RAM Systems

Reduce memory limits in compose file:

```yaml
deploy:
  resources:
    limits:
      memory: 64M  # Reduce from default
```

### Service Not Starting After Reboot

```bash
# Docker
sudo systemctl enable docker
docker compose -f docker-compose.home.yml up -d

# Podman
systemctl --user enable bike-tracker.service
sudo loginctl enable-linger $USER
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start services | `docker compose -f docker-compose.home.yml up -d` |
| Stop services | `docker compose -f docker-compose.home.yml down` |
| View logs | `docker compose -f docker-compose.home.yml logs -f` |
| Restart | `docker compose -f docker-compose.home.yml restart` |
| Update | `docker compose -f docker-compose.home.yml up -d --build` |
| Check status | `docker compose -f docker-compose.home.yml ps` |
| Backup Redis | `docker exec bike_tracker_redis redis-cli -a $REDIS_PASSWORD BGSAVE` |

---

## Further Reading

- [Docker Documentation](https://docs.docker.com/)
- [Podman Documentation](https://podman.io/docs)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare Zero Trust](https://developers.cloudflare.com/cloudflare-one/)
