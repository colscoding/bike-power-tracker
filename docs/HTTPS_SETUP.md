# HTTPS Setup for Service

## Problem

The client is served over HTTPS from `bikepowertracker.com` (GitHub Pages), but the service at `78.109.17.187` only supports HTTP. This causes a **mixed content error** - browsers block HTTP requests from HTTPS pages for security reasons.

## Solution: Enable HTTPS on the Service

Choose one of the following options:

---

## Option 1: Use a Domain Name with Let's Encrypt (Recommended)

This provides a valid, trusted SSL certificate for free. Browsers will not show any security warnings.

### Prerequisites
- A domain name that you control (you already have `bikepowertracker.com`)
- Access to DNS settings to create a subdomain

### Steps

#### 1. Configure DNS
Create an A record pointing a subdomain to your VPS IP:
- **Subdomain**: `api.bikepowertracker.com`
- **Type**: A
- **Value**: `78.109.17.187`
- **TTL**: 3600 (or auto)

##### Done - added in oderland

Wait for DNS propagation (usually 5-30 minutes). Verify with:
```bash
nslookup api.bikepowertracker.com
# Should return 78.109.17.187
```

##### Done

#### 2. Update Nginx Configuration
SSH into your VPS and update `~/bike-power-tracker-service/nginx/default.conf`:

```nginx
upstream backend {
    server app:3000;
}

server {
    listen 80;
    server_name api.bikepowertracker.com;

    # Redirect all HTTP to HTTPS (will be configured by Certbot)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.bikepowertracker.com;

    # SSL certificates will be configured by Certbot
    ssl_certificate /etc/letsencrypt/live/api.bikepowertracker.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.bikepowertracker.com/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy all requests to the Node.js application
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for long-running SSE connections
        proxy_read_timeout 24h;
    }
}
```

#### 3. Update Docker Compose
Edit `~/bike-power-tracker-service/docker-compose.yml` to expose both ports 80 and 443:

```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro  # Mount SSL certificates
    depends_on:
      - app
```


##### done

#### 4. Install Certbot on VPS
```bash
# SSH into your VPS
ssh user@78.109.17.187

# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

#### 5. Stop Docker Nginx (temporarily)
Certbot needs port 80 to verify domain ownership:
```bash
cd ~/bike-power-tracker-service
docker compose down
```

#### 6. Obtain SSL Certificate
```bash
sudo certbot certonly --standalone -d api.bikepowertracker.com
```

Follow the prompts. When successful, certificates will be saved in `/etc/letsencrypt/live/api.bikepowertracker.com/`.

#### 7. Set Up Auto-Renewal
Let's Encrypt certificates expire after 90 days. Set up automatic renewal:
```bash
# Test renewal
sudo certbot renew --dry-run

# Enable automatic renewal (already done by Certbot installation)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### 8. Restart Services
```bash
cd ~/bike-power-tracker-service
docker compose up -d
```

#### 9. Update Client Configuration
Locally, update the client's production environment to use HTTPS:

In `packages/client/.env.production` (create if it doesn't exist):
```env
VITE_API_URL=https://api.bikepowertracker.com
VITE_API_KEY=super-secret-bike-tracker-key
```

#### 10. Rebuild and Deploy Client
```bash
cd packages/client
pnpm build
# Then deploy to GitHub Pages as usual
```

#### 11. Test
Visit https://bikepowertracker.com and try viewing streams. It should now work without mixed content errors.

---

## Option 2: Self-Signed Certificate (Quick Test Only)

⚠️ **Warning**: Self-signed certificates will cause browser security warnings. Use this only for testing.

### Steps

#### 1. Generate Self-Signed Certificate on VPS
```bash
# SSH into VPS
ssh user@78.109.17.187

# Create directory for certificates
sudo mkdir -p /etc/ssl/private

# Generate certificate (valid for 1 year)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/selfsigned.key \
  -out /etc/ssl/certs/selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=78.109.17.187"

# Set permissions
sudo chmod 600 /etc/ssl/private/selfsigned.key
```

#### 2. Update Nginx Configuration
In `~/bike-power-tracker-service/nginx/default.conf`:

```nginx
upstream backend {
    server app:3000;
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 24h;
    }
}
```

#### 3. Update Docker Compose
```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/ssl/certs/selfsigned.crt:/etc/ssl/certs/selfsigned.crt:ro
      - /etc/ssl/private/selfsigned.key:/etc/ssl/private/selfsigned.key:ro
    depends_on:
      - app
```

#### 4. Restart Services
```bash
cd ~/bike-power-tracker-service
docker compose down
docker compose up -d
```

#### 5. Update Client
Use `https://78.109.17.187` in your client configuration.

#### 6. Accept Security Warning
When visiting the site, you'll need to manually accept the browser's security warning about the self-signed certificate.

---

## Recommendation

**Use Option 1** (Let's Encrypt with domain). It's:
- Free
- Trusted by all browsers
- Automatically renews
- More professional
- Required for production use

Only use Option 2 for quick local testing.

## After Setup

Once HTTPS is enabled, also consider:
1. Updating CORS settings in service `.env` to restrict to your domain:
   ```env
   CORS_ORIGIN=https://bikepowertracker.com
   ```
2. Testing all API endpoints to ensure they work over HTTPS
3. Monitoring certificate expiration (Let's Encrypt auto-renews, but good to check)
