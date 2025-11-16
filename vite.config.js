import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
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
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            },
            devOptions: {
                enabled: true,
                type: 'module'
            }
        })
    ]
});
