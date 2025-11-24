import { showNotification } from './ui/notifications.js';

/**
 * Initialize streaming controls
 */
export function initStreamingControls(streamManager, timeState) {
    const startStreamButton = document.getElementById('startStreamButton');
    const modal = document.getElementById('streamNameModal');
    const closeBtn = document.getElementById('closeStreamNameModal');
    const cancelBtn = document.getElementById('cancelStreamName');
    const confirmBtn = document.getElementById('confirmStreamName');
    const nameInput = document.getElementById('streamNameInput');
    const streamStatusDisplay = document.getElementById('streamStatusDisplay');
    const currentStreamName = document.getElementById('currentStreamName');

    const updateStreamStatusDisplay = (isStreaming, name) => {
        if (streamStatusDisplay && currentStreamName) {
            if (isStreaming) {
                streamStatusDisplay.style.display = 'flex';
                currentStreamName.textContent = name;
            } else {
                streamStatusDisplay.style.display = 'none';
                currentStreamName.textContent = '';
            }
        }
    };

    if (!startStreamButton) {
        console.warn('Start stream button not found in DOM');
        return;
    }

    const closeModal = () => {
        if (modal) modal.style.display = 'none';
        if (nameInput) nameInput.value = '';
    };

    const startStreaming = async () => {
        const customName = nameInput ? nameInput.value.trim() : '';

        try {
            const streamName = await streamManager.startStreaming(customName || undefined);
            startStreamButton.textContent = '🔴 Stop Streaming';
            startStreamButton.classList.add('streaming');
            updateStreamStatusDisplay(true, streamName);

            // Show notification
            showNotification(`Streaming to: ${streamName}`, 'success');
            closeModal();
        } catch (error) {
            console.error('Failed to start streaming:', error);
            showNotification('Failed to start streaming: ' + error.message, 'error');
        }
    };

    // Event listeners for modal
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (confirmBtn) {
        confirmBtn.addEventListener('click', startStreaming);
    }

    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                startStreaming();
            }
        });
    }

    // Close on click outside
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    startStreamButton.addEventListener('click', async () => {
        if (streamManager.isStreaming) {
            // Stop streaming
            streamManager.stopStreaming();
            startStreamButton.textContent = '📡 Start Streaming';
            startStreamButton.classList.remove('streaming');
            updateStreamStatusDisplay(false);
        } else {
            // Open modal to start streaming
            if (modal) {
                modal.style.display = 'flex';
                if (nameInput) {
                    nameInput.focus();
                }
            } else {
                // Fallback if modal missing
                try {
                    const streamName = await streamManager.startStreaming();
                    startStreamButton.textContent = '🔴 Stop Streaming';
                    startStreamButton.classList.add('streaming');
                    updateStreamStatusDisplay(true, streamName);
                    showNotification(`Streaming to: ${streamName}`, 'success');
                } catch (error) {
                    console.error('Failed to start streaming:', error);
                    showNotification('Failed to start streaming: ' + error.message, 'error');
                }
            }
        }
    });

    // Auto-stop streaming when workout is stopped
    const originalStartStopHandler = document.getElementById('startStop');
    if (originalStartStopHandler) {
        originalStartStopHandler.addEventListener('click', () => {
            if (timeState.running === false && streamManager.isStreaming) {
                // Workout was just stopped
                setTimeout(() => {
                    if (!timeState.running && streamManager.isStreaming) {
                        streamManager.stopStreaming();
                        startStreamButton.textContent = '📡 Start Streaming';
                        startStreamButton.classList.remove('streaming');
                        updateStreamStatusDisplay(false);
                    }
                }, 100);
            }
        });
    }
}
