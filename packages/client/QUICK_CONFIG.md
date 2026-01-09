# Quick API Configuration Guide

## How to Switch Between Local and Production API During Development

### Option 1: Use Local Development Server (Default)

No configuration needed! Vite will proxy API requests to `localhost:3000`.

```bash
pnpm dev
```

### Option 2: Use Production VPS Server

Create a `.env.local` file to override the default:

```bash
# In packages/client/
cp .env.local.example .env.local
```

Edit `.env.local` and uncomment these lines:

```env
VITE_API_URL=http://78.109.17.187
VITE_API_KEY=super-secret-bike-tracker-key
```

Then run dev server:

```bash
pnpm dev
```

### Option 3: Use Custom Backend

Edit `.env.local`:

```env
VITE_API_URL=http://your-custom-url:port
VITE_API_KEY=your-api-key-if-needed
```

### Switching Back to Local

Simply delete or comment out the lines in `.env.local`:

```env
# VITE_API_URL=http://78.109.17.187
# VITE_API_KEY=super-secret-bike-tracker-key
```

Or delete the `.env.local` file entirely.

### Notes

- `.env.local` is gitignored and won't be committed
- Changes take effect after restarting the dev server
- Use real sensors: Set `VITE_USE_MOCK_SENSORS=false` in `.env.local`
