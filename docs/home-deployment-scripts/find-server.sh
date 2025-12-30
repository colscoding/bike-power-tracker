#!/bin/bash
#
# Bike Power Tracker - Find Server on Network
# Scans local network to find your Ubuntu server
#
# Usage: ./find-server.sh [--subnet 192.168.1.0/24]
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default subnet (will try to auto-detect)
SUBNET=""
SEARCH_HOSTNAME=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --subnet)
            SUBNET="$2"
            shift 2
            ;;
        --hostname)
            SEARCH_HOSTNAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --subnet CIDR     Network to scan (e.g., 192.168.1.0/24)"
            echo "  --hostname NAME   Search for specific hostname"
            echo "  --help            Show this help message"
            exit 0
            ;;
    esac
done

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Network Server Discovery${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Auto-detect subnet if not provided
if [ -z "$SUBNET" ]; then
    echo "Detecting local network..."
    
    # Get default gateway IP to determine network
    if command -v ip &> /dev/null; then
        GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
        LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' | head -1)
    elif command -v route &> /dev/null; then
        GATEWAY=$(route -n get default 2>/dev/null | grep gateway | awk '{print $2}')
        LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    fi
    
    if [ -n "$LOCAL_IP" ]; then
        # Extract network prefix (assumes /24)
        NETWORK_PREFIX=$(echo "$LOCAL_IP" | cut -d. -f1-3)
        SUBNET="${NETWORK_PREFIX}.0/24"
        echo -e "${GREEN}✓ Detected network: $SUBNET${NC}"
        echo "  Your IP: $LOCAL_IP"
        echo "  Gateway: $GATEWAY"
    else
        echo -e "${YELLOW}Could not auto-detect network. Please specify --subnet${NC}"
        exit 1
    fi
fi

echo ""
echo "Scanning network: $SUBNET"
echo "This may take a moment..."
echo ""

# Method 1: Use nmap if available (most reliable)
if command -v nmap &> /dev/null; then
    echo -e "${BLUE}Using nmap to scan for SSH servers...${NC}"
    echo ""
    
    # Scan for hosts with SSH open
    RESULTS=$(nmap -sn -oG - "$SUBNET" 2>/dev/null | grep "Up" | awk '{print $2}')
    
    if [ -n "$RESULTS" ]; then
        echo "Found hosts:"
        echo ""
        printf "%-16s %-20s %-10s\n" "IP Address" "Hostname" "SSH"
        printf "%-16s %-20s %-10s\n" "----------" "--------" "---"
        
        for IP in $RESULTS; do
            # Try to get hostname
            HOSTNAME=$(nmap -sn "$IP" 2>/dev/null | grep "Nmap scan report" | awk '{print $5}' | tr -d '()')
            [ "$HOSTNAME" = "$IP" ] && HOSTNAME="-"
            
            # Check if SSH is open
            SSH_STATUS=$(nmap -p 22 --open "$IP" 2>/dev/null | grep "22/tcp" | awk '{print $2}')
            [ -z "$SSH_STATUS" ] && SSH_STATUS="closed"
            
            # Highlight if SSH is open
            if [ "$SSH_STATUS" = "open" ]; then
                printf "${GREEN}%-16s %-20s %-10s${NC}\n" "$IP" "$HOSTNAME" "$SSH_STATUS"
            else
                printf "%-16s %-20s %-10s\n" "$IP" "$HOSTNAME" "$SSH_STATUS"
            fi
        done
    else
        echo "No hosts found on network"
    fi

# Method 2: Use arp-scan if available
elif command -v arp-scan &> /dev/null; then
    echo -e "${BLUE}Using arp-scan...${NC}"
    echo ""
    sudo arp-scan --localnet 2>/dev/null | grep -v "Interface\|Starting\|packets\|Ending" | head -20

# Method 3: Use ping sweep (slower, works everywhere)
else
    echo -e "${BLUE}Using ping sweep (nmap not installed - this is slower)...${NC}"
    echo ""
    echo "Tip: Install nmap for faster scanning: sudo apt install nmap"
    echo ""
    
    NETWORK_PREFIX=$(echo "$SUBNET" | cut -d. -f1-3)
    
    for i in $(seq 1 254); do
        IP="${NETWORK_PREFIX}.${i}"
        if ping -c 1 -W 1 "$IP" &> /dev/null; then
            # Try to get hostname
            HOSTNAME=$(getent hosts "$IP" 2>/dev/null | awk '{print $2}')
            [ -z "$HOSTNAME" ] && HOSTNAME="-"
            
            # Check SSH
            if nc -z -w 1 "$IP" 22 2>/dev/null; then
                echo -e "${GREEN}$IP    $HOSTNAME    SSH: open${NC}"
            else
                echo "$IP    $HOSTNAME"
            fi
        fi
    done &
    wait
fi

# Method 4: Try mDNS/Avahi
echo ""
echo -e "${BLUE}Checking mDNS/Avahi...${NC}"

if command -v avahi-browse &> /dev/null; then
    echo "SSH services advertised via mDNS:"
    timeout 3 avahi-browse -t _ssh._tcp 2>/dev/null | grep "=" | head -5 || echo "  (none found)"
elif command -v dns-sd &> /dev/null; then
    echo "SSH services (macOS dns-sd):"
    timeout 3 dns-sd -B _ssh._tcp 2>/dev/null | head -5 || echo "  (none found)"
else
    # Try direct .local resolution
    if [ -n "$SEARCH_HOSTNAME" ]; then
        echo "Trying ${SEARCH_HOSTNAME}.local..."
        ping -c 1 "${SEARCH_HOSTNAME}.local" 2>/dev/null && echo -e "${GREEN}Found: ${SEARCH_HOSTNAME}.local${NC}"
    fi
fi

# Summary
echo ""
echo -e "${BLUE}=====================================${NC}"
echo "Next steps:"
echo ""
echo "1. Identify your server from the list above"
echo "2. Note the IP address"
echo "3. Test SSH connection:"
echo "   ssh your-username@<server-ip>"
echo ""
echo "4. Configure for easy access:"
echo "   Add to ~/.ssh/config:"
echo ""
echo "   Host bike-server"
echo "       HostName <server-ip>"
echo "       User your-username"
echo ""
echo "Then use: ssh bike-server"
