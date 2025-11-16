import { registerSW } from 'virtual:pwa-register'

export const registerServiceWorker = () => {
    // Register service worker for PWA functionality using vite-plugin-pwa
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
        onRegisteredSW(swUrl, registration) {
            console.log('Service Worker registered successfully:', swUrl);

            // Check for updates periodically (every hour)
            if (registration) {
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.log('Service Worker registration failed:', error);
        }
    });
}

const showUpdateNotification = (updateSW) => {
    const updateContainer = document.getElementById('updateNotification');
    if (updateContainer) {
        updateContainer.style.display = 'block';

        const updateButton = document.getElementById('updateButton');
        updateButton.addEventListener('click', () => {
            updateSW(true); // Force reload after update
        }, { once: true });

        const dismissUpdateButton = document.getElementById('dismissUpdate');
        dismissUpdateButton.addEventListener('click', () => {
            updateContainer.style.display = 'none';
        }, { once: true });
    }
};