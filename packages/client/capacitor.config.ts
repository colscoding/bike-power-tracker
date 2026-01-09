import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bikepowertracker.app',
  appName: 'Bike Power Tracker',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow mixed content for development
    allowNavigation: ['*']
  },
  android: {
    // Enable WebView debugging
    webContentsDebuggingEnabled: true,
    // Use modern WebView engine
    minWebViewVersion: 55
  },
  plugins: {
  }
};

export default config;
