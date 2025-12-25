# Deployment Guide

This guide describes how to deploy the Bike Power Tracker Service to a Virtual Private Server (VPS).

## Prerequisites

- A VPS (e.g., DigitalOcean, AWS, Linode) running Linux (Ubuntu/Debian recommended).
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on the VPS.
- Git (optional, for cloning the repo).

## Architecture

The production deployment uses Docker Compose to orchestrate three services:

```
┌─────────────────────────────────────────────────────────────┐
│                         VPS                                 │
│  ┌─────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │  Nginx  │──────│   Node.js   │──────│    Redis    │     │
│  │  :80    │      │   App:3000  │      │    :6379    │     │
│  └─────────┘      └─────────────┘      └─────────────┘     │
│       ▲                                                     │
└───────│─────────────────────────────────────────────────────┘
        │
    Internet
```

1. **Nginx**: Reverse proxy listening on port 80, forwards traffic to the application.
2. **App**: Node.js service running the API and SSE streams on port 3000 (internal only).
3. **Redis**: Database for storing streams, secured with password authentication and isolated from the public internet.

## Environment Variables

The service supports the following environment variables (configured in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_PASSWORD` | Password for Redis authentication (required) | Auto-generated |
| `CORS_ORIGIN` | Allowed CORS origin(s) | `*` |
| `API_KEY` | Optional API key for endpoint authentication | Empty (disabled) |
| `APP_PORT` | Internal application port | `3000` |

## Deployment Steps

### 1. Transfer Files

Copy the `packages/service` directory to your VPS. You can use `scp` or `rsync`.

```bash
# Example using rsync from your local machine
rsync -avz packages/service/ user@your-vps-ip:~/bike-power-tracker-service
```

### 2. Run the Deployment Script

SSH into your VPS and run the deployment script.

```bash
ssh user@your-vps-ip
cd bike-power-tracker-service
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Check that Docker and Docker Compose are installed.
2. Generate a secure `.env` file if one doesn't exist (including a random Redis password).
3. Pull the latest base images.
4. Build the Docker images.
5. Start the services in detached mode.
6. Verify the deployment with a health check.

### 3. Verify Deployment

Check if the containers are running:

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see `bike_tracker_nginx`, `bike_tracker_service`, and `bike_tracker_redis` running.

Test the health endpoint:

```bash
curl http://localhost/health
# Expected: {"status":"ok"}
```

Test the API:

```bash
curl http://localhost/api/streams
# Expected: {"streams":[]}
```

### 4. Client Configuration

When building the client application (frontend), configure it to point to your VPS IP or domain.

```bash
# In packages/client
VITE_API_URL=http://<your-vps-ip> pnpm build
```

## Security Configuration

### API Key Authentication (Recommended)

To secure your API endpoints, enable API key authentication:

1. Edit the `.env` file:
   ```bash
   # Uncomment and set an API key
   API_KEY=your-secure-api-key-here
   ```

2. Restart the service:
   ```bash
   docker compose -f docker-compose.prod.yml restart app
   ```

3. Include the API key in requests:
   ```bash
   # Via header (recommended)
   curl -H "X-API-Key: your-secure-api-key-here" http://localhost/api/streams
   
   # Via query parameter
   curl "http://localhost/api/streams?apiKey=your-secure-api-key-here"
   ```

### SSL/HTTPS

To enable HTTPS, you have several options:

**Option 1: Certbot with Nginx**

Use [Certbot](https://certbot.eff.org/) to obtain free Let's Encrypt certificates:

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
certbot --nginx -d yourdomain.com
```

**Option 2: Manual SSL Configuration**

Modify `nginx/default.conf` to include SSL certificates:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;
    
    # ... rest of config
}
```

### CORS Configuration

For production, restrict CORS to your specific frontend domain:

```bash
# In .env
CORS_ORIGIN=https://yourdomain.com
```

## Customization

### Changing Ports

If you need to run on a port other than 80, edit `docker-compose.prod.yml` and change the Nginx port mapping:

```yaml
  nginx:
    ports:
      - "8080:80" # Maps host port 8080 to container port 80
```

### Resource Limits

For production environments, consider adding resource limits in `docker-compose.prod.yml`:

```yaml
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
```

## Operations

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f app

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Restarting Services

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart app
```

### Stopping the Service

```bash
# Stop and remove containers (preserves data)
docker compose -f docker-compose.prod.yml down

# Stop and remove containers AND volumes (deletes all data)
docker compose -f docker-compose.prod.yml down -v
```

### Updating the Application

```bash
# Pull latest code, then redeploy
./deploy.sh

# Or rebuild without pulling base images
./deploy.sh --no-build  # Uses existing images
```

### Backup Redis Data

```bash
# Create a backup
docker exec bike_tracker_redis redis-cli -a $REDIS_PASSWORD BGSAVE

# Copy the dump file
docker cp bike_tracker_redis:/data/dump.rdb ./backup-$(date +%Y%m%d).rdb
```

## Troubleshooting

### Containers Won't Start

```bash
# Check container logs
docker compose -f docker-compose.prod.yml logs

# Check if ports are in use
sudo lsof -i :80
```

### Redis Connection Issues

```bash
# Verify Redis is healthy
docker exec bike_tracker_redis redis-cli -a $REDIS_PASSWORD ping

# Check Redis logs
docker compose -f docker-compose.prod.yml logs redis
```

### Health Check Failing

```bash
# Test directly inside the container
docker exec bike_tracker_service curl -s http://localhost:3000/health

# Check app logs
docker compose -f docker-compose.prod.yml logs app
```

### Permission Denied

Ensure the deploy script is executable:
```bash
chmod +x deploy.sh
```

Ensure your user is in the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```
