/**
 * Workout Timer Component
 * 
 * A Web Component for displaying workout elapsed time.
 * Supports different states: idle, recording, paused.
 * 
 * @example
 * ```html
 * <bpt-workout-timer
 *   elapsed="3661"
 *   state="recording">
 * </bpt-workout-timer>
 * ```
 * 
 * @module WorkoutTimer
 */

import { BaseComponent } from './base/BaseComponent.js';

/**
 * Workout state enum
 */
export type WorkoutTimerState = 'idle' | 'recording' | 'paused';

/**
 * Workout Timer Web Component
 */
export class WorkoutTimer extends BaseComponent {
    private intervalId: number | null = null;
    private startTimestamp = 0;
    private pausedElapsed = 0;

    static get observedAttributes(): string[] {
        return ['elapsed', 'state', 'show-milliseconds'];
    }

    protected getStyles(): string {
        return `
            :host {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
            }
            
            .timer {
                font-size: clamp(20px, 5vw, 32px);
                font-weight: 600;
                color: var(--color-text-primary, #1f2328);
                letter-spacing: 0.5px;
                transition: color 0.3s ease;
            }
            
            :host([state="recording"]) .timer {
                color: var(--color-success, #15803d);
            }
            
            :host([state="paused"]) .timer {
                color: var(--color-warning, #a16207);
                animation: blink 1s ease-in-out infinite;
            }
            
            :host([state="idle"]) .timer {
                color: var(--color-text-muted, #8b949e);
            }
            
            .milliseconds {
                font-size: 0.5em;
                opacity: 0.7;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                :host([state="paused"]) .timer {
                    animation: none;
                }
            }
        `;
    }

    protected getTemplate(): string {
        const elapsed = parseInt(this.getAttribute('elapsed') || '0', 10);
        const showMs = this.hasAttribute('show-milliseconds');
        const timeString = this.formatTime(elapsed, showMs);

        return `
            <time class="timer" datetime="PT${elapsed}S" aria-live="off">
                ${timeString}
            </time>
        `;
    }

    /**
     * Format elapsed seconds to HH:MM:SS or HH:MM:SS.ms
     */
    private formatTime(totalSeconds: number, showMs = false): string {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        const pad = (n: number) => n.toString().padStart(2, '0');
        let result = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

        if (showMs) {
            const ms = Math.floor((totalSeconds % 1) * 100);
            result += `<span class="milliseconds">.${pad(ms)}</span>`;
        }

        return result;
    }

    protected onAttributeChanged(name: string): void {
        if (name === 'state') {
            this.handleStateChange();
        }
        this.render();
    }

    /**
     * Handle state changes
     */
    private handleStateChange(): void {
        const state = this.getAttribute('state') as WorkoutTimerState;

        if (state === 'recording' && !this.intervalId) {
            this.startTicking();
        } else if (state !== 'recording' && this.intervalId) {
            this.stopTicking();
        }
    }

    /**
     * Start the internal tick
     */
    private startTicking(): void {
        this.startTimestamp = Date.now() - (this.pausedElapsed * 1000);
        this.intervalId = window.setInterval(() => {
            const elapsed = (Date.now() - this.startTimestamp) / 1000;
            this.setAttribute('elapsed', String(elapsed));
        }, 100);
    }

    /**
     * Stop the internal tick
     */
    private stopTicking(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.pausedElapsed = parseFloat(this.getAttribute('elapsed') || '0');
    }

    protected onDisconnected(): void {
        this.stopTicking();
    }

    /**
     * Start the timer
     */
    public start(): void {
        this.setAttribute('state', 'recording');
        this.emit('timer-start');
    }

    /**
     * Pause the timer
     */
    public pause(): void {
        this.setAttribute('state', 'paused');
        this.emit('timer-pause');
    }

    /**
     * Resume the timer
     */
    public resume(): void {
        this.setAttribute('state', 'recording');
        this.emit('timer-resume');
    }

    /**
     * Stop and reset the timer
     */
    public stop(): void {
        this.setAttribute('state', 'idle');
        this.pausedElapsed = 0;
        this.emit('timer-stop', { elapsed: parseFloat(this.getAttribute('elapsed') || '0') });
    }

    /**
     * Reset the timer to zero
     */
    public reset(): void {
        this.pausedElapsed = 0;
        this.startTimestamp = Date.now();
        this.setAttribute('elapsed', '0');
        this.emit('timer-reset');
    }

    /**
     * Get the current elapsed time in seconds
     */
    public getElapsed(): number {
        return parseFloat(this.getAttribute('elapsed') || '0');
    }

    /**
     * Get the current state
     */
    public getState(): WorkoutTimerState {
        return (this.getAttribute('state') as WorkoutTimerState) || 'idle';
    }
}

// Register the custom element
customElements.define('bpt-workout-timer', WorkoutTimer);

// Export for type-safe usage
declare global {
    interface HTMLElementTagNameMap {
        'bpt-workout-timer': WorkoutTimer;
    }
}
