/**
 * PWA Install Prompt
 * 
 * Handles the PWA installation prompt for supported browsers.
 * 
 * @module installPrompt
 */

/**
 * Deferred install prompt event
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Extended event interface for beforeinstallprompt
 */
interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Initialize the PWA install prompt handler.
 * 
 * Listens for the beforeinstallprompt event and shows a custom
 * install button when the app can be installed.
 */
export const initInstallPrompt = (): void => {
    // Skip in test mode
    if (import.meta.env.MODE === 'test') {
        return;
    }

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();

        // Stash the event so it can be triggered later
        deferredPrompt = e as BeforeInstallPromptEvent;

        // Show the install button
        showInstallButton();
    });

    // Listen for the app installed event
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed successfully');
        deferredPrompt = null;
        hideInstallButton();
    });
};

/**
 * Show the install button and set up click handlers.
 */
const showInstallButton = (): void => {
    const installContainer = document.getElementById('installPrompt');
    if (!installContainer) return;

    installContainer.style.display = 'block';

    const installButton = document.getElementById('installButton');
    installButton?.addEventListener('click', async () => {
        if (!deferredPrompt) {
            return;
        }

        // Show the install prompt
        await deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // Clear the deferredPrompt
        deferredPrompt = null;
        hideInstallButton();
    });

    const dismissButton = document.getElementById('dismissInstall');
    dismissButton?.addEventListener('click', () => {
        hideInstallButton();
    });
};

/**
 * Hide the install button.
 */
const hideInstallButton = (): void => {
    const installContainer = document.getElementById('installPrompt');
    if (installContainer) {
        installContainer.style.display = 'none';
    }
};
