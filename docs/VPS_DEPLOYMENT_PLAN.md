# VPS Deployment Plan

This document outlines the step-by-step plan for deploying the Bike Power Tracker Service to a Virtual Private Server (VPS).

## 1. Prerequisites

Before starting, ensure you have:
- **SSH Access** to your VPS (IP address, username, and SSH key/password).
- **Docker & Docker Compose** installed on the VPS.
  - If not installed, the `deploy.sh` script will warn you, but it's best to have them ready.
  - Quick install for Ubuntu: `curl -fsSL https://get.docker.com | sh`

## 2. Deployment Strategy

We will deploy the `packages/service` directory as a self-contained unit. The service uses Docker Compose to orchestrate:
- **Node.js App**: The main API service.
- **Redis**: For real-time data streaming.
- **Nginx**: As a reverse proxy.
- **PostgreSQL**: For persistent data storage (workouts, users).

## 3. Step-by-Step Deployment

### Step 1: Prepare Local Files
Ensure you are in the root of the project. We will be deploying the contents of `packages/service`.

### Step 2: Deploy using the Script
We have created a convenience script `deploy-remote.sh` that handles both the file transfer (rsync) and the remote execution.

Run this from the `packages/service` directory:

```bash
# Navigate to the service directory
cd packages/service

# Run the deployment script
# Usage: ./deploy-remote.sh <user@host>
./deploy-remote.sh user@your-vps-ip
```

The script will:
1.  Sync the files to `~/bike-power-tracker-service` on the VPS (excluding `node_modules`, `.env`, etc.).
2.  SSH into the VPS and run the server-side `deploy.sh`.

### Step 3: Verify Deployment
(The script will output the status, but you can verify manually)
After the script completes, verify the service is running:

```bash
# Check running containers
docker compose -f docker-compose.prod.yml ps

# Check logs if needed
docker compose -f docker-compose.prod.yml logs -f
```

You can also verify from your local machine:
```bash
curl http://your-vps-ip/health
# Expected: {"status":"ok"}
```

## 4. Updating the Service

To deploy a new version of the code:

1.  **Local**: Make your changes and commit them.
2.  **Local**: Run the deployment script again:
    ```bash
    ./packages/service/deploy-remote.sh user@your-vps-ip
    ```
    - The script will sync the changes, rebuild the images on the server, and restart the containers.
    - Data in Redis and Postgres will be preserved.

## 5. Troubleshooting

- **Permission Denied**: Ensure your SSH user has permission to run Docker commands (add user to `docker` group: `sudo usermod -aG docker $USER`).
- **Port Conflicts**: Ensure ports 80 (Nginx) is free on the VPS.
- **Database Issues**: If you need to reset the database, you can use `docker compose -f docker-compose.prod.yml down -v` (WARNING: This deletes all data).
