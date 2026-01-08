#!/bin/bash
set -e

# specific directory context
cd "$(dirname "$0")"

echo "Building Web Assets..."
pnpm run android:build

echo "Building Android APK..."
cd android

# Clean previous builds to ensure properties take effect
./gradlew clean

# Build Debug APK with testOnly flag explicitly disabled via project property
# Also ensure we are using the standard debug signing config
./gradlew assembleDebug -Pandroid.injected.testOnly=false

# Verify file exists
if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
    cp app/build/outputs/apk/debug/app-debug.apk ../../../bike-power-tracker.apk
    echo "--------------------------------------------------------"
    echo "SUCCESS! APK copied to: bike-power-tracker.apk (in project root)"
    echo "--------------------------------------------------------"
    echo "NOTE: If you have an old version installed, you MUST"
    echo "uninstall it before installing this one."
    echo "--------------------------------------------------------"
else
    echo "Error: APK file not found!"
    exit 1
fi
