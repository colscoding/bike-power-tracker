#!/bin/bash

# Configuration
APK_PATH="./bike-power-tracker.apk"
USER_ID=$(id -u)
GVFS_PATH="/run/user/$USER_ID/gvfs"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Bike Power Tracker APK Installer (MTP)${NC}"

# 1. Check if APK exists
if [ ! -f "$APK_PATH" ]; then
    echo -e "${RED}Error: APK not found at $APK_PATH${NC}"
    echo "Please run 'packages/client/build-apk.sh' first to generate the APK."
    exit 1
fi

echo "APK found: $APK_PATH"

# 2. Check for GVFS directory (Standard on Ubuntu/Debian/Fedora GNOME/KDE)
if [ ! -d "$GVFS_PATH" ]; then
    echo -e "${RED}Error: GVFS path not found at $GVFS_PATH${NC}"
    echo "This script relies on GVFS (GNOME Virtual File System) to access MTP devices."
    exit 1
fi

echo "Looking for MTP device in $GVFS_PATH..."

# 3. Find MTP mount point
# MTP mounts usually start with "mtp:host="
MTP_MOUNT=$(find "$GVFS_PATH" -maxdepth 1 -name "mtp*" -print -quit 2>/dev/null)

if [ -z "$MTP_MOUNT" ]; then
    echo -e "${RED}No MTP device found.${NC}"
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "1. Connect your Xiaomi phone via USB."
    echo "2. On the phone, select 'File Transfer' or 'MTP' in the USB options."
    echo "3. Open your specific file manager (Nautilus, Dolphin, etc.) and click on the phone to mount it."
    exit 1
fi

echo -e "${GREEN}Device found mounted at: $MTP_MOUNT${NC}"

# 4. Find Download folder
# Structure is typically: Mount -> Internal shared storage -> Download
echo "Searching for Download folder..."
DOWNLOAD_DIR=$(find "$MTP_MOUNT" -maxdepth 3 -type d -name "Download" -print -quit 2>/dev/null)

if [ -z "$DOWNLOAD_DIR" ]; then
    echo -e "${RED}Could not find 'Download' folder automatically.${NC}"
    echo "Directories in root of device:"
    ls -1 "$MTP_MOUNT"
    exit 1
fi

echo "Destination: $DOWNLOAD_DIR"

# 5. Copy file
echo "Copying APK..."
cp -v "$APK_PATH" "$DOWNLOAD_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Success!${NC} APK copied to Phone."
    echo "File location: .../Download/$(basename "$APK_PATH")"
    echo "On your phone, open File Manager -> Downloads and install the APK."
else
    echo -e "${RED}Copy failed.${NC}"
    exit 1
fi
