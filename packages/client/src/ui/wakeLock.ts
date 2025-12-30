/**
 * Wake Lock Handler
 * 
 * Keeps the screen awake during workouts using the Screen Wake Lock API.
 * 
 * @module wakeLock
 */

/**
 * Initialize wake lock to keep the screen awake.
 * 
 * Requests a screen wake lock when the page is visible,
 * and re-requests it if the page visibility changes.
 */
export const handleWakeLock = (): void => {
    let wakeLock: WakeLockSentinel | null = null;

    /**
     * Request a screen wake lock
     */
    const requestWakeLock = async (): Promise<void> => {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock activated');

                // Re-request wake lock if page becomes visible again
                wakeLock.addEventListener('release', () => {
                    console.log('Screen wake lock released');
                });
            }
        } catch (err) {
            console.error('Wake lock request failed:', err);
        }
    };

    // Request wake lock when page loads
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }

    // Re-request wake lock when page becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            requestWakeLock();
        }
    });
};
