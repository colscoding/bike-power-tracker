#!/bin/bash
#
# Bike Power Tracker - Health Check Script
# Monitors service health and optionally restarts on failure
#
# Usage: ./health-check.sh [--restart-on-failure] [--verbose]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SERVICE_DIR:-$(dirname "$SCRIPT_DIR")}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8080/health}"
LOG_FILE="${LOG_FILE:-$HOME/bike-tracker-health.log}"
MAX_RETRIES=3
RETRY_DELAY=5

# Colors (only if terminal supports it)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    NC='\033[0m'
else
    GREEN=''
    YELLOW=''
    RED=''
    NC=''
fi

# Parse arguments
RESTART_ON_FAILURE=false
VERBOSE=false

for arg in "$@"; do
    case $arg in
        --restart-on-failure)
            RESTART_ON_FAILURE=true
            ;;
        --verbose)
            VERBOSE=true
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --restart-on-failure  Automatically restart services if health check fails"
            echo "  --verbose             Show detailed output"
            echo "  --help                Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  HEALTH_URL  Health check endpoint (default: http://localhost:8080/health)"
            echo "  LOG_FILE    Log file location (default: ~/bike-tracker-health.log)"
            exit 0
            ;;
    esac
done

# Detect container runtime
if command -v docker &> /dev/null; then
    COMPOSE_CMD="docker compose"
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    COMPOSE_CMD="podman-compose"
    CONTAINER_CMD="podman"
else
    echo -e "${RED}Error: Neither Docker nor Podman is installed${NC}"
    exit 1
fi

log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [ "$VERBOSE" = true ] || [ "$level" = "ERROR" ] || [ "$level" = "WARN" ]; then
        case $level in
            ERROR) echo -e "${RED}[$level] $message${NC}" ;;
            WARN)  echo -e "${YELLOW}[$level] $message${NC}" ;;
            INFO)  echo -e "${GREEN}[$level] $message${NC}" ;;
            *)     echo "[$level] $message" ;;
        esac
    fi
}

check_http_health() {
    local url="$1"
    local response
    local http_code
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>/dev/null) || response="000"
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

check_container_health() {
    local container_name="$1"
    local status
    
    status=$($CONTAINER_CMD inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null) || status="not_found"
    
    case $status in
        healthy) return 0 ;;
        *) return 1 ;;
    esac
}

restart_services() {
    log_message "WARN" "Attempting to restart services..."
    
    cd "$SERVICE_DIR"
    
    $COMPOSE_CMD -f docker-compose.home.yml restart
    
    # Wait for services to come up
    sleep 10
    
    if check_http_health "$HEALTH_URL"; then
        log_message "INFO" "Services restarted successfully"
        return 0
    else
        log_message "ERROR" "Services failed to recover after restart"
        return 1
    fi
}

# Main health check
main() {
    local exit_code=0
    local failed_checks=0
    
    echo "Bike Power Tracker - Health Check"
    echo "=================================="
    echo ""
    
    # Check HTTP endpoint
    echo -n "Checking HTTP endpoint ($HEALTH_URL)... "
    for i in $(seq 1 $MAX_RETRIES); do
        if check_http_health "$HEALTH_URL"; then
            echo -e "${GREEN}OK${NC}"
            log_message "INFO" "HTTP health check passed"
            break
        else
            if [ $i -eq $MAX_RETRIES ]; then
                echo -e "${RED}FAILED${NC}"
                log_message "ERROR" "HTTP health check failed after $MAX_RETRIES attempts"
                failed_checks=$((failed_checks + 1))
            else
                echo -n "retry ($i/$MAX_RETRIES)... "
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    # Check container health
    echo ""
    echo "Container Status:"
    
    for container in bike_tracker_nginx bike_tracker_service bike_tracker_redis; do
        echo -n "  $container: "
        
        if ! $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "$container"; then
            echo -e "${RED}NOT RUNNING${NC}"
            log_message "ERROR" "Container $container is not running"
            failed_checks=$((failed_checks + 1))
        elif check_container_health "$container"; then
            echo -e "${GREEN}HEALTHY${NC}"
        else
            # Get actual status
            status=$($CONTAINER_CMD inspect --format='{{.State.Status}}' "$container" 2>/dev/null) || status="unknown"
            health=$($CONTAINER_CMD inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null) || health="no healthcheck"
            echo -e "${YELLOW}$status ($health)${NC}"
            log_message "WARN" "Container $container status: $status, health: $health"
        fi
    done
    
    # Check optional containers
    for container in bike_tracker_postgres bike_tracker_tunnel; do
        if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "$container"; then
            echo -n "  $container: "
            if check_container_health "$container"; then
                echo -e "${GREEN}HEALTHY${NC}"
            else
                status=$($CONTAINER_CMD inspect --format='{{.State.Status}}' "$container" 2>/dev/null) || status="unknown"
                echo -e "${YELLOW}$status${NC}"
            fi
        fi
    done
    
    # Check disk space
    echo ""
    echo -n "Disk space: "
    disk_usage=$(df -h "$SERVICE_DIR" 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%')
    if [ -n "$disk_usage" ] && [ "$disk_usage" -gt 90 ]; then
        echo -e "${RED}${disk_usage}% used (WARNING: Low disk space)${NC}"
        log_message "WARN" "Disk space usage is ${disk_usage}%"
    else
        echo -e "${GREEN}${disk_usage:-unknown}% used${NC}"
    fi
    
    # Check memory
    echo -n "Memory: "
    if command -v free &> /dev/null; then
        mem_usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
        if [ "$mem_usage" -gt 90 ]; then
            echo -e "${RED}${mem_usage}% used (WARNING: High memory usage)${NC}"
            log_message "WARN" "Memory usage is ${mem_usage}%"
        else
            echo -e "${GREEN}${mem_usage}% used${NC}"
        fi
    else
        echo "unknown"
    fi
    
    # Summary
    echo ""
    echo "=================================="
    
    if [ $failed_checks -eq 0 ]; then
        echo -e "${GREEN}All checks passed!${NC}"
        exit_code=0
    else
        echo -e "${RED}$failed_checks check(s) failed${NC}"
        exit_code=1
        
        if [ "$RESTART_ON_FAILURE" = true ]; then
            restart_services || exit_code=2
        fi
    fi
    
    return $exit_code
}

# Run main function
main
exit $?
