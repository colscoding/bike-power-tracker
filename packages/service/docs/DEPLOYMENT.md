# Deployment

The service is designed to be containerized using Docker.

## Docker Setup

### Files
-   `Dockerfile`: Multi-stage build for production. Optimizes image size by separating build dependencies from runtime.
-   `Dockerfile.dev`: Development container with hot-reload (via `tsx` or `nodemon`).
-   `docker-compose.yml`: Base composition.
-   `docker-compose.prod.yml`: Production overrides (restart policies, volume mapping).
-   `docker-compose.home.yml`: Specific configuration for home server deployment.

### Building & Running

**Development:**
```bash
docker-compose up url --build
```

**Production:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Deployment Scripts

Located in the root `deploy/` folder and `packages/service/` root.

-   `deploy.sh`: Main entry point for deploying to a remote server.
-   `deploy-remote.sh`: Script executed ON the remote server to pull changes and restart containers.
-   `copy-remote.sh`: Helper to sync files to the remote server using `rsync`.

## Reverse Proxy (Nginx)

The `nginx/` folder contains configuration for the Nginx proxy that sits in front of the Node.js service.
-   Handles SSL termination (if configured).
-   Proxy headers for SSE (EventSource) support (crucial for keeping connections open).

## Environment Variables

See `.env.example` for all required variables. Ensure these are set in your CI/CD pipeline or `.env` file on the production server.
