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
 * Listens for the beforeinstallprompt event and captures it for later use.
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

        // Update install button visibility in settings
        updateInstallButtonVisibility();
    });

    // Listen for the app installed event
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed successfully');
        deferredPrompt = null;
        updateInstallButtonVisibility();
    });
};

/**
 * Check if the app can be installed.
 * @returns true if install is available
 */
export const canInstallPwa = (): boolean => {
    return deferredPrompt !== null;
};

/**
 * Trigger the PWA install prompt.
 * @returns Promise that resolves to the user's choice outcome
 */
export const triggerInstallPrompt = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) {
        return 'unavailable';
    }

    try {
        // Show the install prompt
        await deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // Clear the deferredPrompt
        deferredPrompt = null;
        updateInstallButtonVisibility();

        return outcome;
    } catch (error) {
        console.error('Error triggering install prompt:', error);
        return 'unavailable';
    }
};

/**
 * Update the visibility of install buttons based on availability.
 */
const updateInstallButtonVisibility = (): void => {
    const installButton = document.getElementById('installPwaButton');
    const installButtonContainer = document.getElementById('installPwaContainer');

    if (installButton) {
        installButton.style.display = canInstallPwa() ? 'block' : 'none';
    }

    if (installButtonContainer) {
        installButtonContainer.style.display = canInstallPwa() ? 'block' : 'none';
    }
};
