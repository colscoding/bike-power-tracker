# Remote Server Management Guide

This guide explains how to find your Ubuntu home server on the local network, copy files to it, and manage the Bike Power Tracker service remotely.

## Table of Contents

1. [Finding Your Server](#finding-your-server)
2. [SSH Setup](#ssh-setup)
3. [Copying Files](#copying-files)
4. [Remote Service Management](#remote-service-management)
5. [Convenience Scripts](#convenience-scripts)

---

## Finding Your Server

### Method 1: Check Your Router

The easiest way is to check your router's admin page:

1. Open your router's admin page (usually `http://192.168.1.1` or `http://192.168.0.1`)
2. Look for "Connected Devices", "DHCP Clients", or "Network Map"
3. Find your Ubuntu server by hostname or MAC address

### Method 2: Use Network Scanning

From your local machine (Linux/Mac):

```bash
# Install nmap if needed
# Ubuntu/Debian: sudo apt install nmap
# Mac: brew install nmap

# Scan your local network (adjust IP range for your network)
nmap -sn 192.168.1.0/24

# Or scan for SSH services specifically
nmap -p 22 192.168.1.0/24
```

Example output:
```
Nmap scan report for 192.168.1.100
Host is up (0.0012s latency).
PORT   STATE SERVICE
22/tcp open  ssh
```

### Method 3: mDNS/Avahi (Recommended)

If your server has Avahi installed, you can find it by hostname:

**On the server (Ubuntu):**
```bash
# Install and enable Avahi
sudo apt install avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Check your hostname
hostname
```

**On your local machine:**
```bash
# Mac/Linux - ping by hostname
ping your-server-hostname.local

# Or use avahi-browse (Linux)
avahi-browse -art | grep -i "your-hostname"
```

### Method 4: From the Server Itself

If you have physical access or existing SSH:

```bash
# Show all IP addresses
ip addr show | grep "inet " | grep -v 127.0.0.1

# Or more concisely
hostname -I

# Show network interfaces
ip link show
```

### Setting a Static IP (Recommended)

To avoid the server's IP changing, configure a static IP:

**Option A: Router DHCP Reservation**
1. Find your server's MAC address: `ip link show`
2. In router settings, add a DHCP reservation for that MAC

**Option B: Ubuntu Netplan Configuration**

```bash
# Edit netplan config
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:  # or your interface name (check with: ip link)
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

```bash
# Apply changes
sudo netplan apply
```

---

## SSH Setup

### On the Server (Ubuntu)

```bash
# Install OpenSSH server
sudo apt update
sudo apt install openssh-server

# Enable and start SSH
sudo systemctl enable ssh
sudo systemctl start ssh

# Check status
sudo systemctl status ssh

# Optional: Configure firewall
sudo ufw allow ssh
sudo ufw enable
```

### On Your Local Machine

**Generate SSH Key (if you don't have one):**
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter to accept defaults
```

**Copy Key to Server:**
```bash
# Replace with your server's IP
ssh-copy-id user@192.168.1.100

# Or manually
cat ~/.ssh/id_ed25519.pub | ssh user@192.168.1.100 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

**Test Connection:**
```bash
ssh user@192.168.1.100
```

**Create SSH Config for Easy Access:**

Edit `~/.ssh/config`:
```
Host bike-server
    HostName 192.168.1.100
    User your-username
    IdentityFile ~/.ssh/id_ed25519
```

Now you can simply use:
```bash
ssh bike-server
```

---

## Copying Files

### Using rsync (Recommended)

```bash
# Sync entire service directory to server
rsync -avz --progress \
  packages/service/ \
  user@192.168.1.100:~/bike-power-tracker/

# Using SSH config alias
rsync -avz --progress \
  packages/service/ \
  bike-server:~/bike-power-tracker/

# Exclude node_modules and other unnecessary files
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '*.log' \
  packages/service/ \
  bike-server:~/bike-power-tracker/
```

### Using scp

```bash
# Copy entire directory
scp -r packages/service/ user@192.168.1.100:~/bike-power-tracker/

# Copy specific files
scp packages/service/docker-compose.home.yml user@192.168.1.100:~/bike-power-tracker/
```

### Using the Deploy Script

See [deploy-to-server.sh](home-deployment-scripts/deploy-to-server.sh) for automated deployment.

---

## Remote Service Management

### Direct SSH Commands

```bash
# Check if containers are running
ssh bike-server "docker ps" 
# or
ssh bike-server "podman ps"

# Start services
ssh bike-server "cd ~/bike-power-tracker && docker compose -f docker-compose.home.yml up -d"

# Stop services
ssh bike-server "cd ~/bike-power-tracker && docker compose -f docker-compose.home.yml down"

# View logs
ssh bike-server "cd ~/bike-power-tracker && docker compose -f docker-compose.home.yml logs -f"

# Check health
ssh bike-server "curl -s http://localhost:8080/health"
```

### Using the Remote Management Script

See [remote-control.sh](home-deployment-scripts/remote-control.sh) for a convenient wrapper.

---

## Convenience Scripts

The following scripts are available in `docs/home-deployment-scripts/`:

| Script | Description |
|--------|-------------|
| `deploy-to-server.sh` | Copy files and deploy to remote server |
| `remote-control.sh` | Start, stop, and manage remote service |
| `find-server.sh` | Scan network to find the server |

### Quick Usage

```bash
# Find your server
./find-server.sh

# Deploy to server
./deploy-to-server.sh --host 192.168.1.100 --user christian

# Remote management
./remote-control.sh start
./remote-control.sh stop
./remote-control.sh status
./remote-control.sh logs
```

---

## Troubleshooting

### Can't Find Server on Network

```bash
# Check if server is connected
# On server: 
ip addr show
ping 8.8.8.8  # Test internet
ping 192.168.1.1  # Test gateway

# Check if SSH is running
sudo systemctl status ssh
```

### SSH Connection Refused

```bash
# On server - check SSH is running
sudo systemctl status ssh

# Check firewall
sudo ufw status

# Allow SSH
sudo ufw allow 22/tcp
```

### Permission Denied (SSH)

```bash
# Check key permissions on local machine
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub

# On server - check authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### rsync Fails

```bash
# Install rsync on server
ssh bike-server "sudo apt install rsync"

# Test SSH connection first
ssh bike-server "echo 'Connected!'"
```

### Docker/Podman Permission Denied

```bash
# For Docker - add user to docker group
ssh bike-server "sudo usermod -aG docker \$USER"
# Log out and back in on server

# For Podman - should work rootless by default
# Enable lingering for services to persist
ssh bike-server "sudo loginctl enable-linger \$USER"
```
