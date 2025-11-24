#!/bin/bash

# Deployment script for Bike Power Tracker Service

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    echo "REDIS_PASSWORD=$(openssl rand -hex 16)" > .env
    echo "APP_PORT=3000" >> .env
    echo "CORS_ORIGIN=*" >> .env
    echo "Created .env file. Please edit it if needed."
fi

# Load environment variables
source .env

echo "Deploying with:"
echo "CORS_ORIGIN: $CORS_ORIGIN"

# Build and start containers
docker compose -f docker-compose.prod.yml up -d --build

echo "Deployment complete! Service is running on port 80 (via Nginx)"
