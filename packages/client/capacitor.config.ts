import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bikepowertracker.app',
  appName: 'Bike Power Tracker',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Scanning for bike sensors...",
        cancel: "Cancel",
        availableDevices: "Available devices",
        noDeviceFound: "No device found"
      }
    }
  }
};

export default config;
