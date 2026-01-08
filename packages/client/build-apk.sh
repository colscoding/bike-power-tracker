#!/bin/bash

pnpm run android:build
cd ~/bike-power-tracker/packages/client/android
./gradlew assembleDebug
cp ~/bike-power-tracker/packages/client/android/app/build/outputs/apk/debug/app-debug.apk ~/bike-power-tracker/bike-power-tracker.apk
cd ~/bike-power-tracker