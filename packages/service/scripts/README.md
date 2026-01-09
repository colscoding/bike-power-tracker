# Backup & Restore Scripts

Automated backup and restore scripts for the Bike Power Tracker Service.

## Quick Start

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run complete backup (recommended)
./scripts/backup-all.sh

# Or run individual backups
./scripts/backup-postgres.sh
./scripts/backup-redis.sh
./scripts/backup-volumes.sh
```

## Scripts Overview

| Script | Purpose | Output |
|--------|---------|--------|
| `backup-all.sh` | Complete backup of all databases and volumes | All backups |
| `backup-postgres.sh` | PostgreSQL database dump | `postgres-YYYYMMDD-HHMMSS.dump` |
| `backup-redis.sh` | Redis RDB snapshot | `redis-YYYYMMDD-HHMMSS.rdb` |
| `backup-volumes.sh` | Docker volume archives | `*-volume-YYYYMMDD-HHMMSS.tar.gz` |
| `restore-postgres.sh` | Restore PostgreSQL backup | - |

## Configuration

All scripts support environment variables for customization:

```bash
# Backup directory (default: ./backups)
export BACKUP_DIR="/path/to/backups"

# Retention period in days (default: 7)
export RETENTION_DAYS=14

# Container names (if different from defaults)
export POSTGRES_CONTAINER="my_postgres"
export REDIS_CONTAINER="my_redis"

# Database credentials
export POSTGRES_USER="biketracker"
export POSTGRES_DB="biketracker"
export REDIS_PASSWORD="your-redis-password"
```

## Automated Backups

### Using Cron

Add to crontab for automated daily backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /home/user/bike-power-tracker/packages/service && ./scripts/backup-all.sh >> /var/log/bike-tracker-backup.log 2>&1

# Or weekly full backup on Sundays at 3 AM
0 3 * * 0 cd /home/user/bike-power-tracker/packages/service && ./scripts/backup-all.sh >> /var/log/bike-tracker-backup.log 2>&1
```

### Using Systemd Timer (Alternative)

Create `/etc/systemd/system/bike-tracker-backup.service`:

```ini
[Unit]
Description=Bike Tracker Database Backup
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/home/user/bike-power-tracker/packages/service
ExecStart=/home/user/bike-power-tracker/packages/service/scripts/backup-all.sh
User=user
StandardOutput=append:/var/log/bike-tracker-backup.log
StandardError=append:/var/log/bike-tracker-backup.log
```

Create `/etc/systemd/system/bike-tracker-backup.timer`:

```ini
[Unit]
Description=Daily Bike Tracker Backup
Requires=bike-tracker-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl enable bike-tracker-backup.timer
sudo systemctl start bike-tracker-backup.timer
sudo systemctl status bike-tracker-backup.timer
```

## Restore Process

### PostgreSQL Restore

```bash
# List available backups
ls -lh backups/postgres-*.dump

# Restore specific backup
./scripts/restore-postgres.sh backups/postgres-20250109-020000.dump
```

### Redis Restore

```bash
# Stop Redis container
docker compose stop redis

# Copy backup to volume
docker run --rm \
  -v redis_data:/data \
  -v $(pwd)/backups:/backup \
  alpine \
  cp /backup/redis-20250109-020000.rdb /data/dump.rdb

# Start Redis container
docker compose start redis
```

### Volume Restore

```bash
# Stop services
docker compose down

# Restore PostgreSQL volume
docker run --rm \
  -v postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine \
  sh -c "cd /data && tar xzf /backup/postgres-volume-20250109-020000.tar.gz"

# Restore Redis volume
docker run --rm \
  -v redis_data:/data \
  -v $(pwd)/backups:/backup \
  alpine \
  sh -c "cd /data && tar xzf /backup/redis-volume-20250109-020000.tar.gz"

# Start services
docker compose up -d
```

## Offsite Backups

### Using rsync

```bash
# Sync backups to remote server
rsync -avz --delete \
  backups/ \
  user@backup-server:/backups/bike-tracker/

# Add to cron for automatic offsite backup after local backup
5 2 * * * rsync -avz --delete backups/ user@backup-server:/backups/bike-tracker/ >> /var/log/bike-tracker-offsite.log 2>&1
```

### Using Cloud Storage (S3/B2)

```bash
# Install AWS CLI or rclone
sudo apt install awscli

# Configure credentials
aws configure

# Sync to S3
aws s3 sync backups/ s3://your-bucket/bike-tracker-backups/

# Or use rclone for Backblaze B2
rclone sync backups/ b2:your-bucket/bike-tracker-backups/
```

## Monitoring

### Check Backup Status

```bash
# View recent backups
ls -lht backups/ | head -10

# Check backup sizes
du -sh backups/*

# Verify backup integrity (PostgreSQL)
docker exec postgres pg_restore -U biketracker --list backups/postgres-20250109-020000.dump | head -20
```

### Alert on Backup Failure

Add to backup script or cron:

```bash
#!/bin/bash
if ! ./scripts/backup-all.sh; then
    # Send email alert
    echo "Backup failed on $(hostname) at $(date)" | mail -s "BACKUP FAILED" admin@example.com
    
    # Or send to monitoring service
    curl -X POST https://monitoring.example.com/alert \
      -d "service=bike-tracker-backup&status=failed"
fi
```

## Backup Strategy Recommendations

### Development
- **Frequency**: Weekly or before major changes
- **Retention**: 4 weeks
- **Location**: Local only

### Production
- **Frequency**: Daily (automated)
- **Retention**: 30 days local, 90 days offsite
- **Location**: 
  - Local: `/backups` on VPS
  - Offsite: S3/B2 or separate server
- **Testing**: Monthly restore test

### Critical Production
- **Frequency**: 
  - Full backup: Daily at 2 AM
  - Incremental: Every 6 hours
- **Retention**: 
  - 7 days local
  - 90 days offsite
  - 1 year archive (monthly snapshots)
- **Monitoring**: Automated alerts on failure
- **Testing**: Weekly automated restore verification

## Troubleshooting

### Backup Script Fails

```bash
# Check container status
docker compose ps

# View container logs
docker logs postgres
docker logs redis

# Test database connection
docker exec postgres pg_isready -U biketracker

# Check disk space
df -h
```

### Restore Fails

```bash
# Check backup file integrity
file backups/postgres-20250109-020000.dump
pg_restore --list backups/postgres-20250109-020000.dump

# Try verbose restore to see errors
docker exec -i postgres pg_restore -U biketracker -d biketracker --verbose < backup.dump
```

### No Space for Backups

```bash
# Clean old backups manually
find backups/ -name "*.dump" -mtime +30 -delete
find backups/ -name "*.rdb" -mtime +30 -delete
find backups/ -name "*.tar.gz" -mtime +30 -delete

# Or adjust retention
export RETENTION_DAYS=3
./scripts/backup-all.sh
```

## Security Considerations

1. **Encrypt backups** before storing offsite:
```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 backups/postgres-20250109-020000.dump

# Decrypt when needed
gpg backups/postgres-20250109-020000.dump.gpg
```

2. **Secure backup directory** with appropriate permissions:
```bash
chmod 700 backups/
chown -R user:user backups/
```

3. **Use separate credentials** for backup operations
4. **Rotate backup encryption keys** periodically
5. **Test restore process** regularly to ensure backups are valid

## Support

For issues or questions:
- Check logs in `/var/log/bike-tracker-backup.log`
- Review Docker container logs
- Consult main documentation in `docs/DATABASE_POSTGRESQL.md`
