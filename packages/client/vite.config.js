import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
    },
    resolve: {
        alias: process.env.NODE_ENV === 'production' ? [] : [
            { find: './connect-power.js', replacement: fileURLToPath(new URL('./src/connect-power.mock.ts', import.meta.url)) },
            { find: './connect-cadence.js', replacement: fileURLToPath(new URL('./src/connect-cadence.mock.ts', import.meta.url)) },
            { find: './connect-heartrate.js', replacement: fileURLToPath(new URL('./src/connect-heartrate.mock.ts', import.meta.url)) }
        ]
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        },
        headers: {
            'Cache-Control': 'no-store' // Prevent browser caching in development
        }
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'script',
            includeAssets: ['favicon.ico', 'assets/**/*'],
            manifest: {
                id: './',
                name: 'Bike Power Tracker',
                short_name: 'Bike Power Tracker',
                description: 'Track your spin bike: power, cadence, and heart rate with bluetooth sensors',
                start_url: './',
                scope: './',
                display: 'standalone',
                background_color: '#1a1a1a',
                theme_color: '#2196F3',
                orientation: 'portrait-primary',
                lang: 'en',
                dir: 'ltr',
                categories: ['health', 'fitness', 'sports'],
                icons: [
                    {
                        src: 'assets/icons/icon-72.png',
                        sizes: '72x72',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/icons/icon-96.png',
                        sizes: '96x96',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/icons/icon-128.png',
                        sizes: '128x128',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/icons/icon-144.png',
                        sizes: '144x144',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/icons/icon-152.png',
                        sizes: '152x152',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/icons/icon-180.png',
                        sizes: '180x180',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/icons/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: 'assets/icons/icon-384.png',
                        sizes: '384x384',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ],
                screenshots: [
                    {
                        src: 'assets/screenshots/mobile.png',
                        sizes: '381x889',
                        type: 'image/png',
                        form_factor: 'narrow',
                        label: 'Bike Power Tracker app displaying real-time metrics on mobile'
                    },
                    {
                        src: 'assets/screenshots/desktop.png',
                        sizes: '1909x956',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Bike Power Tracker app displaying real-time metrics on desktop'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                // Cache the app shell and all static assets
                runtimeCaching: [
                    {
                        // Cache Google Fonts stylesheets
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-stylesheets',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache Google Fonts webfonts
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // API calls - NetworkFirst with fallback to cache
                        urlPattern: /\/api\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 // 24 hours
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            },
                            networkTimeoutSeconds: 10 // Fall back to cache after 10s
                        }
                    },
                    {
                        // Images - CacheFirst with network fallback
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // JavaScript and CSS - StaleWhileRevalidate
                        urlPattern: /\.(?:js|css)$/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'static-resources',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ],
                // Skip waiting and claim clients immediately
                skipWaiting: true,
                clientsClaim: true,
                // Clean up old caches
                cleanupOutdatedCaches: true,
                // Precache the navigation routes
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [/^\/api\//]
            },
            devOptions: {
                enabled: false, // Disable service worker in dev to prevent caching issues
                type: 'module'
            }
        })
    ]
});
