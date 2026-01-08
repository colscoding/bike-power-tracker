/**
 * Service Worker Registration
 * 
 * Handles PWA service worker registration using vite-plugin-pwa.
 * 
 * @module serviceWorker
 */

import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

/**
 * Update callback type
 */
type UpdateCallback = (reloadPage?: boolean) => Promise<void>;

/**
 * Register the service worker for PWA functionality.
 * 
 * In development mode, service workers are disabled to avoid caching issues.
 * In production, registers the service worker and handles updates.
 */
export const registerServiceWorker = (): void => {
    // Capacitor apps should not use service workers. They can cause hard-to-debug
    // caching and asset-loading issues in Android WebView.
    if (Capacitor.isNativePlatform()) {
        console.log('Service Worker disabled on native platform');
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister();
                }
            });
        }
        return;
    }

    // Don't register service worker in development to avoid caching issues
    if (import.meta.env.DEV) {
        console.log('Service Worker disabled in development mode');
        // Unregister existing service workers if any to ensure fresh content
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister();
                    console.log('Unregistered existing service worker');
                }
            });
        }
        return;
    }

    // Skip in test mode
    if (import.meta.env.MODE === 'test') {
        return;
    }

    const updateSW = registerSW({
        onNeedRefresh() {
            showUpdateNotification(updateSW);
        },
        onOfflineReady() {
            console.log('App ready to work offline');
        },
        onRegistered(registration?: ServiceWorkerRegistration) {
            console.log('Service Worker registered successfully');

            // Check for updates periodically (every hour)
            if (registration) {
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error: Error) {
            console.log('Service Worker registration failed:', error);
        },
    });
};

/**
 * Show update notification when a new version is available.
 * 
 * @param updateSW - Function to trigger the update
 */
const showUpdateNotification = (updateSW: UpdateCallback): void => {
    const updateContainer = document.getElementById('updateNotification');
    if (!updateContainer) return;

    updateContainer.style.display = 'block';

    const updateButton = document.getElementById('updateButton');
    updateButton?.addEventListener(
        'click',
        () => {
            updateSW(true); // Force reload after update
        },
        { once: true }
    );

    const dismissUpdateButton = document.getElementById('dismissUpdate');
    dismissUpdateButton?.addEventListener(
        'click',
        () => {
            updateContainer.style.display = 'none';
        },
        { once: true }
    );
};
