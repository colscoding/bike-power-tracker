/**
 * Workout Countdown Overlay
 * 
 * Shows a countdown before starting a workout.
 * Supports visual, audio (beep), and voice announcements.
 * 
 * @module ui/countdown
 */

import { getSettings } from '../config/settings.js';
import { voiceFeedback } from '../services/VoiceFeedback.js';
import { announce } from './accessibility.js';

/**
 * Show countdown overlay and execute callback when complete
 * 
 * @param onComplete - Callback to execute after countdown finishes
 * @returns Promise that resolves when countdown is complete or cancelled
 */
export async function showCountdown(onComplete: () => void): Promise<void> {
    const settings = getSettings();
    const duration = settings.countdown.duration;

    // If countdown is disabled (duration = 0), immediately execute callback
    if (duration === 0) {
        onComplete();
        return;
    }

    return new Promise((resolve) => {
        // Create overlay
        const overlay = createCountdownOverlay();
        document.body.appendChild(overlay);

        let currentCount = duration;
        let intervalId: number;
        let isCancelled = false;

        // Update display
        const updateDisplay = (count: number) => {
            const countElement = overlay.querySelector('.countdown__number') as HTMLElement;
            if (countElement) {
                countElement.textContent = count === 0 ? 'GO!' : count.toString();
                countElement.className = 'countdown__number';

                // Add animation class
                requestAnimationFrame(() => {
                    countElement.classList.add('countdown__number--pulse');
                });
            }

            // Voice announcement
            if (settings.countdown.enableVoice) {
                voiceFeedback.announceCountdown(count);
            }

            // Beep sound
            if (settings.countdown.enableBeep) {
                playBeep(count === 0);
            }

            // Screen reader announcement
            const text = count === 0 ? 'Go! Workout starting' : `${count}`;
            announce(text, 'assertive');
        };

        // Cancel button handler
        const cancelBtn = overlay.querySelector('.countdown__cancel') as HTMLButtonElement;
        const handleCancel = () => {
            isCancelled = true;
            clearInterval(intervalId);
            document.body.removeChild(overlay);
            announce('Countdown cancelled', 'assertive');
            resolve();
        };
        cancelBtn?.addEventListener('click', handleCancel);

        // ESC key to cancel
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);

        // Start countdown
        updateDisplay(currentCount);

        intervalId = window.setInterval(() => {
            currentCount--;

            if (currentCount >= 0) {
                updateDisplay(currentCount);
            }

            if (currentCount < 0) {
                clearInterval(intervalId);
                document.removeEventListener('keydown', handleKeydown);

                if (!isCancelled) {
                    // Remove overlay
                    document.body.removeChild(overlay);

                    // Execute callback
                    onComplete();
                }

                resolve();
            }
        }, 1000);
    });
}

/**
 * Create countdown overlay DOM element
 */
function createCountdownOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-labelledby', 'countdownTitle');
    overlay.setAttribute('aria-live', 'assertive');

    overlay.innerHTML = `
        <div class="countdown__backdrop"></div>
        <div class="countdown__content">
            <h2 id="countdownTitle" class="countdown__title">Get Ready!</h2>
            <div class="countdown__number"></div>
            <button class="countdown__cancel" aria-label="Cancel countdown">
                Cancel (ESC)
            </button>
        </div>
    `;

    return overlay;
}

/**
 * Play a beep sound using Web Audio API
 * 
 * @param isFinal - If true, plays a higher-pitched "go" beep
 */
function playBeep(isFinal: boolean = false): void {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Frequency: Higher for final beep
        oscillator.frequency.value = isFinal ? 880 : 440; // A5 or A4
        oscillator.type = 'sine';

        // Volume envelope
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.warn('Failed to play beep:', error);
    }
}
