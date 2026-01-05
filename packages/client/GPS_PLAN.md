# GPS Integration Plan for Bike Power Tracker

This plan outlines the steps to add GPS tracking capabilities to the Bike Power Tracker, enabling distance, speed, and location tracking on both Web and Native (Android/iOS) platforms.

## 1. Dependencies

We will use `@capacitor-community/background-geolocation` for native apps to ensure tracking continues when the screen is off or the app is in the background, matching the "Running App" specification. For the web, we will use the standard `navigator.geolocation` API.

### Action Items
- [ ] Install the plugin:
  ```bash
  npm install @capacitor-community/background-geolocation
  ```
- [ ] Sync Capacitor:
  ```bash
  npx cap sync
  ```

## 2. Data Model Updates

We need to store GPS coordinates, not just scalar values like speed or distance.

### Action Items
- [ ] Update `packages/client/src/types/measurements.ts`:
  - Define `GpsPoint` interface:
    ```typescript
    export interface GpsPoint {
        timestamp: number;
        lat: number;
        lon: number;
        accuracy: number;
        altitude: number | null;
        speed: number | null; // m/s
        heading: number | null;
    }
    ```
  - Update `MeasurementsData` to include a `gps` array:
    ```typescript
    export interface MeasurementsData {
        // ... existing fields
        gps: GpsPoint[];
    }
    ```

## 3. Service Architecture (Factory Pattern)

We will implement a `GpsService` using the Factory Pattern, similar to the Bluetooth implementation.

### Action Items
- [ ] Create `packages/client/src/services/gps/types.ts`:
  - Define `GpsListener` and `GpsService` interface.
- [ ] Create `packages/client/src/services/gps/web-gps.ts`:
  - Implement using `navigator.geolocation.watchPosition`.
- [ ] Create `packages/client/src/services/gps/native-gps.ts`:
  - Implement using `@capacitor-community/background-geolocation`.
  - Handle permissions and background service configuration.
- [ ] Create `packages/client/src/services/gps/factory.ts`:
  - Switch between Web and Native implementations based on `Capacitor.isNativePlatform()`.

## 4. Native Permissions

Configure Android and iOS to allow background location tracking.

### Android (`AndroidManifest.xml`)
- [ ] Add permissions:
  ```xml
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
  ```
- [ ] Register the service in `<application>`:
  ```xml
  <service
      android:name="com.equimaps.capacitor_background_geolocation.BackgroundGeolocationService"
      android:foregroundServiceType="location"
      android:exported="false" />
  ```

### iOS (`Info.plist`)
- [ ] Add keys:
  - `NSLocationWhenInUseUsageDescription`
  - `NSLocationAlwaysAndWhenInUseUsageDescription`
  - `NSLocationAlwaysUsageDescription`
  - `UIBackgroundModes` (array including `location`)

## 5. Application Logic Integration

Connect the GPS service to the main application state.

### Action Items
- [ ] Create `packages/client/src/connect-gps.ts`:
  - A wrapper similar to `connect-power.ts` that initializes the service and manages the connection.
- [ ] Update the main store/state management to subscribe to GPS updates.
- [ ] Calculate derived metrics:
  - **Distance**: Calculate cumulative distance using the Haversine formula between points.
  - **Speed**: Use the GPS speed if available, or calculate from distance/time.

## 6. UI Updates

Display the new metrics to the user.

### Action Items
- [ ] Update the main dashboard to show:
  - Distance (km/miles)
  - Speed (km/h or mph)
  - (Optional) Map view using Leaflet (if requested later, but good to plan for).

## 7. Data Export

Include GPS data in exports.

### Action Items
- [ ] Update `packages/client/src/merge-measurements.ts`:
  - Include GPS lat/lon/alt in the merged data points.
- [ ] Update `packages/client/src/create-csv.ts`:
  - Add columns: `lat`, `lon`, `altitude`, `speed`.
- [ ] (Optional) Create `create-tcx.ts` or `create-gpx.ts` for standard GPS track exports.

## 8. Testing

### Action Items
- [ ] Test Web implementation in browser (with mock location or real device).
- [ ] Test Native implementation on Android Emulator (simulate location).
- [ ] Test Native implementation on physical device (verify background tracking).
