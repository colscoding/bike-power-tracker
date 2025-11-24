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

    // Toolbar elements
    const toolbar = document.getElementById('activeStreamToolbar');
    const toolbarStreamName = document.getElementById('toolbarStreamName');
    const playPauseBtn = document.getElementById('streamPlayPauseBtn');
    const stopBtn = document.getElementById('streamStopBtn');
    const streamIndicator = document.querySelector('.stream-indicator');

    const updateToolbar = (status) => {
        if (!toolbar) return;

        if (status.isStreaming) {
            toolbar.style.display = 'flex';
            document.body.classList.add('has-stream-toolbar');
            if (toolbarStreamName) toolbarStreamName.textContent = status.streamName;

            // Update Play/Pause button
            if (status.isPaused) {
                playPauseBtn.textContent = '▶️';
                playPauseBtn.title = 'Resume Stream';
                if (streamIndicator) streamIndicator.classList.add('paused');
            } else {
                playPauseBtn.textContent = '⏸️';
                playPauseBtn.title = 'Pause Stream';
                if (streamIndicator) streamIndicator.classList.remove('paused');
            }
        } else {
            toolbar.style.display = 'none';
            document.body.classList.remove('has-stream-toolbar');
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

            updateToolbar(streamManager.getStatus());

            // Show notification
            showNotification(`Streaming to: ${streamName}`, 'success');
            closeModal();
        } catch (error) {
            console.error('Failed to start streaming:', error);
            showNotification('Failed to start streaming: ' + error.message, 'error');
        }
    };

    const stopStreaming = async () => {
        try {
            await streamManager.stopStreaming();
            startStreamButton.textContent = '📡 Start Streaming';
            startStreamButton.classList.remove('streaming');

            updateToolbar(streamManager.getStatus());

            showNotification('Streaming stopped', 'info');
        } catch (error) {
            console.error(error);
            showNotification('Error stopping stream', 'error');
        }
    };

    // Wire up toolbar buttons
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            const status = streamManager.getStatus();
            if (status.isPaused) {
                streamManager.resumeStreaming();
                showNotification('Stream Resumed', 'success');
            } else {
                streamManager.pauseStreaming();
                showNotification('Stream Paused', 'info');
            }
            updateToolbar(streamManager.getStatus());
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', async () => {
            if (confirm('Stop streaming?')) {
                await stopStreaming();
            }
        });
    }

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
            await stopStreaming();
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
                    updateToolbar(streamManager.getStatus());
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
                        updateToolbar(streamManager.getStatus());
                    }
                }, 100);
            }
        });
    }
}
