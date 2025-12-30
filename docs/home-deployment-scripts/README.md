# Home Deployment Scripts

This directory contains scripts for deploying and managing the Bike Power Tracker service on a home server.

## Quick Start

### Local Deployment (on the server itself)

```bash
# Make all scripts executable
chmod +x *.sh

# Run initial setup
./setup.sh

# Start the service
./start.sh
```

### Remote Deployment (from your laptop to a home server)

```bash
# Make scripts executable
chmod +x *.sh

# Find your server on the network
./find-server.sh

# Deploy to the server
./deploy-to-server.sh 192.168.1.100 username

# Manage the remote service
./remote-control.sh status
./remote-control.sh logs
./remote-control.sh restart
```

## Scripts Overview

### Local Server Scripts

| Script | Description |
|--------|-------------|
| [setup.sh](setup.sh) | Initial setup - creates config files and directories |
| [start.sh](start.sh) | Start all services |
| [stop.sh](stop.sh) | Stop all services |
| [update.sh](update.sh) | Update to latest version |
| [backup.sh](backup.sh) | Create backups of Redis/database |
| [restore.sh](restore.sh) | Restore from backup |
| [health-check.sh](health-check.sh) | Check service health |
| [logs.sh](logs.sh) | View container logs |
| [setup-cloudflare.sh](setup-cloudflare.sh) | Configure Cloudflare Tunnel |
| [install-cron.sh](install-cron.sh) | Install automated cron jobs |

### Remote Management Scripts

| Script | Description |
|--------|-------------|
| [find-server.sh](find-server.sh) | Scan network to find your home server |
| [deploy-to-server.sh](deploy-to-server.sh) | Copy files and deploy to remote server |
| [remote-control.sh](remote-control.sh) | Start/stop/monitor service on remote server |

## Detailed Usage

### setup.sh - Initial Setup

Run this first to set up your environment:

```bash
# Basic setup
./setup.sh

# With Cloudflare Tunnel support
./setup.sh --with-cloudflare

# With SQLite database
./setup.sh --with-sqlite

# With PostgreSQL database
./setup.sh --with-postgres

# Full setup
./setup.sh --with-cloudflare --with-postgres
```

This script will:
- Check prerequisites (Docker/Podman)
- Create necessary directories
- Generate secure passwords
- Create `.env` configuration file
- Create `docker-compose.home.yml`
- Set up Nginx configuration

### start.sh / stop.sh - Service Control

```bash
# Start services
./start.sh

# Start and rebuild containers
./start.sh --build

# Start with Cloudflare tunnel
./start.sh --cloudflare

# Stop services (preserves data)
./stop.sh

# Stop and remove all data (DANGEROUS!)
./stop.sh --remove-volumes
```

### backup.sh - Create Backups

```bash
# Backup Redis only (default)
./backup.sh

# Backup everything
./backup.sh --all

# Backup specific components
./backup.sh --redis
./backup.sh --postgres
./backup.sh --sqlite
```

Backups are stored in `~/bike-tracker-backups/` by default.

Environment variables:
- `BACKUP_DIR` - Custom backup directory
- `RETENTION_DAYS` - Days to keep backups (default: 7)

### restore.sh - Restore from Backup

```bash
# Restore Redis
./restore.sh ~/bike-tracker-backups/redis-20250101-120000.rdb.gz --redis

# Restore PostgreSQL
./restore.sh ~/bike-tracker-backups/postgres-20250101-120000.dump --postgres

# Restore SQLite
./restore.sh ~/bike-tracker-backups/sqlite-20250101-120000.db.gz --sqlite
```

### health-check.sh - Monitor Health

```bash
# Basic health check
./health-check.sh

# Verbose output
./health-check.sh --verbose

# Auto-restart on failure
./health-check.sh --restart-on-failure
```

### logs.sh - View Logs

```bash
# All logs
./logs.sh

# Follow logs in real-time
./logs.sh -f

# Specific service
./logs.sh app -f

# Last 100 lines
./logs.sh --tail 100
```

Services: `app`, `redis`, `nginx`, `postgres`, `tunnel`

### update.sh - Update Service

```bash
# Update with confirmation
./update.sh

# Update with backup first
./update.sh --backup-first

# Force update (no prompts)
./update.sh --force
```

### setup-cloudflare.sh - Cloudflare Tunnel

Interactive setup for Cloudflare Tunnel:

```bash
./setup-cloudflare.sh
```

This will:
1. Install cloudflared if needed
2. Authenticate with Cloudflare
3. Create a tunnel
4. Configure DNS
5. Save tunnel token to `.env`

### install-cron.sh - Automated Tasks

```bash
# Install daily backup (2 AM)
./install-cron.sh --backup-daily

# Install health check (every 5 minutes)
./install-cron.sh --health-check

# Install all cron jobs
./install-cron.sh --all
```

## Directory Structure After Setup

```
packages/service/
├── .env                      # Environment configuration
├── docker-compose.home.yml   # Docker Compose for home deployment
├── data/                     # SQLite database (if used)
├── nginx/
│   └── default.conf          # Nginx configuration
└── scripts/                  # Installed helper scripts

~/bike-tracker-backups/       # Backup storage
~/bike-tracker-health.log     # Health check log
~/bike-tracker-backup.log     # Backup log
```

## Environment Variables

Key environment variables in `.env`:

| Variable | Description |
|----------|-------------|
| `REDIS_PASSWORD` | Redis authentication password |
| `API_KEY` | API authentication key |
| `APP_PORT` | External port (default: 8080) |
| `CORS_ORIGIN` | Allowed CORS origins |
| `POSTGRES_PASSWORD` | PostgreSQL password (if enabled) |
| `DATABASE_URL` | Database connection string |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel token |

## Troubleshooting

### Services won't start

```bash
# Check logs
./logs.sh -f

# Check container status
docker compose -f docker-compose.home.yml ps

# Check for port conflicts
sudo lsof -i :8080
```

### Health check failing

```bash
# Run verbose health check
./health-check.sh --verbose

# Test endpoint manually
curl http://localhost:8080/health
```

### Backup/restore issues

```bash
# Check if containers are running
docker ps

# Manual Redis backup
docker exec bike_tracker_redis redis-cli -a "$REDIS_PASSWORD" BGSAVE
```

## Further Reading

- [Remote Server Guide](../REMOTE_SERVER_GUIDE.md) - Complete guide for remote server management
- [Home Deployment Guide](../HOME_DEPLOYMENT.md) - Full deployment documentation
- [Database Plans](../DATABASE_PLAN.md) - Database configuration options

---

## Remote Management Scripts - Detailed Usage

### find-server.sh - Network Discovery

Find your home server on the local network:

```bash
# Auto-scan local network
./find-server.sh

# Scan specific subnet
./find-server.sh 192.168.1.0/24

# Discover via mDNS (Avahi)
./find-server.sh --mdns

# Scan for specific hostname
./find-server.sh --hostname myserver
```

The script will:
- Auto-detect your network subnet
- Scan for devices with SSH (port 22) open
- Try multiple methods: nmap, arp-scan, ping sweep
- Display discovered hosts with SSH access

### deploy-to-server.sh - Remote Deployment

Deploy the Bike Power Tracker to your home server:

```bash
# Basic deployment
./deploy-to-server.sh 192.168.1.100 username

# Using specific SSH key
./deploy-to-server.sh 192.168.1.100 username --key ~/.ssh/my_key

# Deploy to custom directory
./deploy-to-server.sh 192.168.1.100 username --dir ~/my-tracker

# Skip build step (files only)
./deploy-to-server.sh 192.168.1.100 username --no-build
```

This will:
1. Test SSH connection
2. Auto-detect Docker or Podman on server
3. Sync files using rsync
4. Generate `.env` with secure credentials
5. Build containers
6. Start services
7. Verify health

After deployment, your connection info is saved to `.server-config` for use with `remote-control.sh`.

### remote-control.sh - Service Management

Control the service running on your home server:

```bash
# Show status (uses saved config from deploy)
./remote-control.sh status

# Start/stop/restart
./remote-control.sh start
./remote-control.sh stop
./remote-control.sh restart

# View logs (live follow)
./remote-control.sh logs

# Health check
./remote-control.sh health

# Create backup on server
./remote-control.sh backup

# Update service (git pull + rebuild)
./remote-control.sh update

# Open SSH shell on server
./remote-control.sh shell

# Execute arbitrary command
./remote-control.sh exec 'docker ps'
./remote-control.sh exec 'df -h'
```

**Override connection settings:**

```bash
# Specify host/user directly
./remote-control.sh status --host 192.168.1.100 --user christian

# Use specific SSH key
./remote-control.sh logs --key ~/.ssh/server_key
```

## Workflow Examples

### Initial Setup from Laptop

```bash
# 1. Find your server
./find-server.sh
# Output: Found 192.168.1.100 (myserver.local)

# 2. Set up SSH key (if not done)
ssh-copy-id christian@192.168.1.100

# 3. Deploy to server
./deploy-to-server.sh 192.168.1.100 christian

# 4. Open in browser
# http://192.168.1.100:8080
```

### Daily Management

```bash
# Check if service is running
./remote-control.sh status

# View recent logs
./remote-control.sh logs

# Update after making changes
./remote-control.sh update
```

### Troubleshooting

```bash
# Full health check
./remote-control.sh health

# SSH into server to debug
./remote-control.sh shell

# Check Docker containers
./remote-control.sh exec 'docker ps -a'

# View system resources
./remote-control.sh exec 'free -h && df -h'
```
