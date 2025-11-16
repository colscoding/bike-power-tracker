# Bike Power Tracker

Track your spin bike: power, cadence, and heart rate with Bluetooth sensors.

## Live App

🚴 **[https://colscoding.github.io/bike-power-tracker/](https://colscoding.github.io/bike-power-tracker/)**

## Features

- **Real-time Metrics**: Monitor power (watts), cadence (RPM), and heart rate (BPM)
- **Bluetooth Connectivity**: Connect to Bluetooth cycling sensors
- **Timer**: Track workout duration
- **Data Export**: Download workout data as JSON, TCX, and CSV formats
- **PWA Support**: Install as a Progressive Web App on mobile and desktop
- **Offline Capable**: Works without an internet connection once installed

## Tech Stack

- **Build Tool**: Vite
- **PWA**: vite-plugin-pwa with Workbox
- **Testing**: Node.js test runner, Playwright
- **Deployment**: GitHub Pages

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build
```
