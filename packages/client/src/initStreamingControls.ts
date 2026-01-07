/**
 * Streaming Controls Initialization
 * 
 * Sets up UI controls for starting, pausing, and stopping workout streaming.
 * 
 * @module initStreamingControls
 */

import { showNotification } from './ui/notifications.js';
import type { StreamManager, StreamStatus } from './stream-manager.js';
import type { TimeState } from './getInitState.js';

/**
 * Initialize streaming controls.
 * 
 * Sets up event handlers for:
 * - Start/stop streaming button
 * - Stream name modal
 * - Toolbar play/pause/stop buttons
 * - Auto-stop when workout ends
 * 
 * @param streamManager - The stream manager instance
 * @param timeState - The workout time state
 */
export function initStreamingControls(
    streamManager: StreamManager,
    timeState: TimeState
): void {
    // Main button
    const startStreamButton = document.getElementById('startStreamButton') as HTMLButtonElement | null;

    // Modal elements
    const modal = document.getElementById('streamNameModal') as HTMLDivElement | null;
    const closeBtn = document.getElementById('closeStreamNameModal') as HTMLButtonElement | null;
    const cancelBtn = document.getElementById('cancelStreamName') as HTMLButtonElement | null;
    const confirmBtn = document.getElementById('confirmStreamName') as HTMLButtonElement | null;
    const nameInput = document.getElementById('streamNameInput') as HTMLInputElement | null;

    // Toolbar elements
    const toolbar = document.getElementById('activeStreamToolbar') as HTMLDivElement | null;
    const toolbarStreamName = document.getElementById('toolbarStreamName') as HTMLSpanElement | null;
    const playPauseBtn = document.getElementById('streamPlayPauseBtn') as HTMLButtonElement | null;
    const stopBtn = document.getElementById('streamStopBtn') as HTMLButtonElement | null;
    const streamIndicator = document.querySelector('.stream-indicator') as HTMLElement | null;

    /**
     * Update toolbar visibility and state
     */
    const updateToolbar = (status: StreamStatus): void => {
        if (!toolbar) return;

        if (status.isStreaming) {
            toolbar.style.display = 'flex';
            document.body.classList.add('has-stream-toolbar');

            if (toolbarStreamName) {
                toolbarStreamName.textContent = status.streamName;
            }

            // Update Play/Pause button
            if (playPauseBtn) {
                if (status.isPaused) {
                    playPauseBtn.textContent = '▶️';
                    playPauseBtn.title = 'Resume Stream';
                    streamIndicator?.classList.add('paused');
                } else {
                    playPauseBtn.textContent = '⏸️';
                    playPauseBtn.title = 'Pause Stream';
                    streamIndicator?.classList.remove('paused');
                }
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

    /**
     * Close the stream name modal
     */
    const closeModal = (): void => {
        if (modal) modal.style.display = 'none';
        if (nameInput) nameInput.value = '';
    };

    /**
     * Start streaming with optional custom name
     */
    const startStreaming = async (): Promise<void> => {
        const customName = nameInput?.value.trim() || '';

        try {
            const streamName = await streamManager.startStreaming(customName || undefined);
            startStreamButton.textContent = '🔴 Stop Streaming';
            startStreamButton.classList.add('streaming');

            updateToolbar(streamManager.getStatus());
            showNotification(`Streaming to: ${streamName}`, 'success');
            closeModal();
        } catch (error) {
            console.error('Failed to start streaming:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            showNotification('Failed to start streaming: ' + message, 'error');
        }
    };

    /**
     * Stop streaming
     */
    const stopStreaming = async (): Promise<void> => {
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
        nameInput.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                startStreaming();
            }
        });
    }

    // Close on click outside
    if (modal) {
        modal.addEventListener('click', (e: MouseEvent) => {
            if (e.target === modal) closeModal();
        });
    }

    // Main button click handler
    startStreamButton.addEventListener('click', async () => {
        if (streamManager.isStreaming) {
            await stopStreaming();
        } else {
            if (modal) {
                modal.style.display = 'flex';
                nameInput?.focus();
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
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    showNotification('Failed to start streaming: ' + message, 'error');
                }
            }
        }
    });

    // Auto-stop streaming when workout is stopped (Pause or Stop buttons)
    const pauseButton = document.getElementById('pauseButton');
    const stopButton = document.getElementById('stopButton');

    const handleWorkoutPause = () => {
        if (timeState.running === false && streamManager.isStreaming) {
            // Workout was just paused
            setTimeout(() => {
                if (!timeState.running && streamManager.isStreaming) {
                    streamManager.stopStreaming();
                    startStreamButton.textContent = '📡 Start Streaming';
                    startStreamButton.classList.remove('streaming');
                    updateToolbar(streamManager.getStatus());
                }
            }, 100);
        }
    };

    if (pauseButton) {
        pauseButton.addEventListener('click', handleWorkoutPause);
    }
    if (stopButton) {
        stopButton.addEventListener('click', handleWorkoutPause);
    }
}
