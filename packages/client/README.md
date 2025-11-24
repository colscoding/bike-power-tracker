# Bike Power Tracker - Client

Progressive Web App for tracking spin bike workouts with Bluetooth sensors.

## Features

- **Real-time Metrics**: Monitor power (watts), cadence (RPM), and heart rate (BPM)
- **Bluetooth Connectivity**: Connect to Bluetooth cycling sensors
- **Live Streaming**: Stream your workout data in real-time
- **Stream Viewer**: Watch other users' workouts live
- **Timer**: Track workout duration
- **Data Export**: Download workout data as JSON, TCX, and CSV
- **PWA Support**: Install as an app on mobile and desktop
- **Offline Capable**: Works without internet once installed

## Development

```bash
# From monorepo root
pnpm dev:client

# Or from this directory
pnpm dev
```

The app will be available at `http://localhost:5173`

### Cache Issues in Development

The service worker is **disabled in development** to prevent caching issues. If you're still seeing stale content:

**Option 1: Hard Reload**
- Chrome/Edge: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Firefox: `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)

**Option 2: Clear Service Worker (if previously installed)**
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Clear Storage** in sidebar
4. Click **Clear site data** button
5. Reload the page

**Option 3: Use clear-sw.js helper**
- Visit `http://localhost:5173/clear-sw.js` in your browser
- This will unregister any service workers and clear caches

**Note:** Service workers only run in production builds (`pnpm build` + `pnpm preview`)


## Building

```bash
pnpm build
```

Output will be in the `dist/` directory.

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
```

## Configuration

Create a `.env` file (see `.env.example`):

```bash
# API URL for streaming service
# Leave empty to use Vite proxy (default for development)
VITE_API_URL=
```

## Project Structure

```
client/
├── src/
│   ├── api/              # API clients
│   ├── ui/               # UI components
│   ├── main.js           # App initialization
│   └── main.css          # Global styles
├── public/               # Static assets
├── test-e2e/             # Playwright tests
├── index.html            # Entry point
└── vite.config.js        # Vite configuration
```

## Deployment

The client is deployed to GitHub Pages:

🚴 **[https://colscoding.github.io/bike-power-tracker/](https://colscoding.github.io/bike-power-tracker/)**

For VPS deployment of the full stack (Client + Service), see the [Deployment Guide](../../docs/DEPLOY.md).

## License

ISC
