/**
 * About Modal
 * 
 * Manages the About modal.
 * 
 * @module about
 */

/**
 * Initialize the About modal
 */
export function initAboutModal(): void {
    const aboutButton = document.getElementById('aboutButton');
    const aboutModal = document.getElementById('aboutModal');
    const closeAboutModal = document.getElementById('closeAboutModal');

    if (!aboutButton || !aboutModal) {
        return;
    }

    /**
     * Open the about modal
     */
    const openModal = (): void => {
        aboutModal.style.display = 'flex';
        // Close the main menu details element
        const details = document.querySelector('header details');
        if (details) {
            details.removeAttribute('open');
        }
    };

    /**
     * Close the about modal
     */
    const closeModal = (): void => {
        aboutModal.style.display = 'none';
    };

    // Event Listeners
    aboutButton.addEventListener('click', openModal);
    closeAboutModal?.addEventListener('click', closeModal);

    // Close modal when clicking outside
    window.addEventListener('click', (event: MouseEvent) => {
        if (event.target === aboutModal) {
            closeModal();
        }
    });
}
