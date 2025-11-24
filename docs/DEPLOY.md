# Deployment Guide

This guide describes how to deploy the Bike Power Tracker Service to a Virtual Private Server (VPS).

## Prerequisites

- A VPS (e.g., DigitalOcean, AWS, Linode) running Linux (Ubuntu/Debian recommended).
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on the VPS.
- Git (optional, for cloning the repo).

## Architecture

The production deployment uses Docker Compose to orchestrate three services:
1.  **Nginx**: A reverse proxy that listens on port 80 and forwards traffic to the application.
2.  **App**: The Node.js service running the API and SSE streams.
3.  **Redis**: The database for storing streams, secured with a password and isolated from the public internet.

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
1.  Generate a secure `.env` file if one doesn't exist (including a random Redis password).
2.  Build the Docker images.
3.  Start the services in detached mode.

### 3. Verify Deployment

Check if the containers are running:

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see `bike_tracker_nginx`, `bike_tracker_service`, and `bike_tracker_redis` running.

Test the API:

```bash
curl http://localhost/api/streams
```

### 4. Client Configuration

When building the client application (frontend), configure it to point to your VPS IP or domain.

```bash
# In packages/client
VITE_API_URL=http://<your-vps-ip> pnpm build
```

## Customization

### SSL/HTTPS

To enable HTTPS, you can modify `nginx/default.conf` to include SSL certificates and listen on port 443. Alternatively, you can use a tool like [Certbot](https://certbot.eff.org/) with Nginx.

### Changing Ports

If you need to run on a port other than 80, edit `docker-compose.prod.yml` and change the Nginx port mapping:

```yaml
  nginx:
    ports:
      - "8080:80" # Maps host port 8080 to container port 80
```
