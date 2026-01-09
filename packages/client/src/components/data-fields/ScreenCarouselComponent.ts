/**
 * Screen Carousel Web Component
 * 
 * Provides swipe navigation between multiple data screens.
 * Supports touch gestures and keyboard navigation.
 * 
 * @example
 * ```html
 * <bpt-screen-carousel>
 *   <bpt-data-screen screen-id="main"></bpt-data-screen>
 *   <bpt-data-screen screen-id="power"></bpt-data-screen>
 * </bpt-screen-carousel>
 * ```
 * 
 * @module components/data-fields/ScreenCarouselComponent
 */

import type { ActivityProfile, DataScreen } from '../../data-fields/types.js';
import type { UserSettings } from '../../data-fields/types.js';
import { DataScreenComponent } from './DataScreenComponent.js';

// Ensure dependencies are registered
import './DataScreenComponent.js';

// ============================================================================
// Types
// ============================================================================

export interface ScreenChangeEvent {
    screenIndex: number;
    screen: DataScreen;
    direction: 'next' | 'prev' | 'direct';
}

// ============================================================================
// Component Definition
// ============================================================================

/**
 * Custom element for swipeable screen navigation
 */
export class ScreenCarouselComponent extends HTMLElement {
    private profile: ActivityProfile | null = null;
    private activeIndex = 0;
    private screenElements: DataScreenComponent[] = [];
    private settings: UserSettings | null = null;
    private shadow: ShadowRoot;

    // Touch handling
    private touchStartX = 0;
    private touchStartY = 0;
    private touchDeltaX = 0;
    private isSwiping = false;
    private swipeThreshold = 50;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    connectedCallback(): void {
        this.render();
        this.setupEventListeners();
    }

    disconnectedCallback(): void {
        this.removeEventListeners();
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Set the activity profile with screens to display
     */
    public setProfile(profile: ActivityProfile): void {
        this.profile = profile;
        this.activeIndex = profile.activeScreenIndex;
        this.render();
    }

    /**
     * Get the current profile
     */
    public getProfile(): ActivityProfile | null {
        return this.profile;
    }

    /**
     * Set user settings for all screens
     */
    public setSettings(settings: UserSettings): void {
        this.settings = settings;
        for (const screenEl of this.screenElements) {
            screenEl.setSettings(settings);
        }
    }

    /**
     * Navigate to the next screen
     */
    public nextScreen(): void {
        if (!this.profile) return;
        const newIndex = (this.activeIndex + 1) % this.profile.screens.length;
        this.goToScreen(newIndex, 'next');
    }

    /**
     * Navigate to the previous screen
     */
    public prevScreen(): void {
        if (!this.profile) return;
        const newIndex = this.activeIndex === 0
            ? this.profile.screens.length - 1
            : this.activeIndex - 1;
        this.goToScreen(newIndex, 'prev');
    }

    /**
     * Navigate to a specific screen by index
     */
    public goToScreen(index: number, direction: 'next' | 'prev' | 'direct' = 'direct'): void {
        if (!this.profile) return;

        const clampedIndex = Math.max(0, Math.min(index, this.profile.screens.length - 1));
        if (clampedIndex === this.activeIndex) return;

        this.activeIndex = clampedIndex;
        this.updateActiveScreen();
        this.dispatchScreenChange(direction);
    }

    /**
     * Get the currently active screen index
     */
    public getActiveIndex(): number {
        return this.activeIndex;
    }

    /**
     * Get the currently active screen
     */
    public getActiveScreen(): DataScreen | null {
        return this.profile?.screens[this.activeIndex] ?? null;
    }

    /**
     * Get the active screen component
     */
    public getActiveScreenElement(): DataScreenComponent | null {
        return this.screenElements[this.activeIndex] ?? null;
    }

    /**
     * Update a field value on the active screen
     */
    public updateFieldValue(fieldId: string, value: number | null): void {
        const activeScreen = this.getActiveScreenElement();
        if (activeScreen) {
            activeScreen.updateFieldByFieldId(fieldId, value);
        }
    }

    /**
     * Update field values on all screens
     */
    public updateAllFieldValues(updates: Map<string, number | null>): void {
        for (const screenEl of this.screenElements) {
            for (const [fieldId, value] of updates) {
                screenEl.updateFieldByFieldId(fieldId, value);
            }
        }
    }

    /**
     * Set sensor connection status for fields that require the sensor
     */
    public setSensorConnected(sensorType: string, connected: boolean): void {
        for (const screenEl of this.screenElements) {
            screenEl.setSensorConnected(sensorType, connected);
        }
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    private render(): void {
        this.screenElements = [];

        if (!this.profile || this.profile.screens.length === 0) {
            this.shadow.innerHTML = `
                <style>${this.getStyles()}</style>
                <div class="carousel carousel--empty">
                    <p>No screens configured</p>
                </div>
            `;
            return;
        }

        this.shadow.innerHTML = `
            <style>${this.getStyles()}</style>
            <div class="carousel">
                <div class="carousel__track" style="transform: translateX(-${this.activeIndex * 100}%)">
                    ${this.renderScreens()}
                </div>
                ${this.renderIndicator()}
            </div>
        `;

        this.setupScreenElements();
    }

    private renderScreens(): string {
        if (!this.profile) return '';

        return this.profile.screens
            .map((_screen, index) => `
                <div class="carousel__slide ${index === this.activeIndex ? 'carousel__slide--active' : ''}"
                     data-index="${index}">
                    <bpt-data-screen data-screen-index="${index}"></bpt-data-screen>
                </div>
            `)
            .join('');
    }

    private renderIndicator(): string {
        if (!this.profile || this.profile.screens.length <= 1) return '';

        const dots = this.profile.screens
            .map((screen, index) => `
                <button class="carousel__dot ${index === this.activeIndex ? 'carousel__dot--active' : ''}"
                        data-index="${index}"
                        aria-label="Go to ${screen.name} screen"
                        title="${screen.name}">
                    <span class="carousel__dot-icon">${screen.icon}</span>
                </button>
            `)
            .join('');

        return `
            <div class="carousel__indicator">
                ${dots}
            </div>
        `;
    }

    private setupScreenElements(): void {
        if (!this.profile) return;

        const screenEls = this.shadow.querySelectorAll('bpt-data-screen');
        screenEls.forEach((el, index) => {
            const screenEl = el as DataScreenComponent;
            const screen = this.profile!.screens[index];
            screenEl.setScreen(screen);
            if (this.settings) {
                screenEl.setSettings(this.settings);
            }
            this.screenElements.push(screenEl);
        });
    }

    private updateActiveScreen(): void {
        // Update track position
        const track = this.shadow.querySelector('.carousel__track') as HTMLElement;
        if (track) {
            track.style.transform = `translateX(-${this.activeIndex * 100}%)`;
        }

        // Update slide classes
        const slides = this.shadow.querySelectorAll('.carousel__slide');
        slides.forEach((slide, index) => {
            slide.classList.toggle('carousel__slide--active', index === this.activeIndex);
        });

        // Update indicator
        const dots = this.shadow.querySelectorAll('.carousel__dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('carousel__dot--active', index === this.activeIndex);
        });
    }

    // ========================================================================
    // Event Handling
    // ========================================================================

    private setupEventListeners(): void {
        const container = this.shadow.querySelector('.carousel') as HTMLElement;
        if (!container) return;

        // Touch events on the container element
        container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });

        // Indicator clicks
        container.addEventListener('click', this.handleClick.bind(this));

        // Keyboard navigation
        this.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    private removeEventListeners(): void {
        // Event listeners are automatically removed when shadow DOM is cleared
    }

    private handleTouchStart(e: TouchEvent): void {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchDeltaX = 0;
        this.isSwiping = false;
    }

    private handleTouchMove(e: TouchEvent): void {
        if (!this.profile || this.profile.screens.length <= 1) return;

        const deltaX = e.touches[0].clientX - this.touchStartX;
        const deltaY = e.touches[0].clientY - this.touchStartY;

        // Determine if this is a horizontal swipe
        if (!this.isSwiping && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            this.isSwiping = true;
        }

        if (this.isSwiping) {
            e.preventDefault();
            this.touchDeltaX = deltaX;

            // Apply visual feedback during swipe
            const track = this.shadow.querySelector('.carousel__track') as HTMLElement;
            if (track) {
                const baseOffset = -this.activeIndex * 100;
                const swipeOffset = (deltaX / this.offsetWidth) * 100;
                track.style.transform = `translateX(calc(${baseOffset}% + ${swipeOffset}%))`;
                track.style.transition = 'none';
            }
        }
    }

    private handleTouchEnd(_e: TouchEvent): void {
        if (!this.isSwiping) return;

        const track = this.shadow.querySelector('.carousel__track') as HTMLElement;
        if (track) {
            track.style.transition = '';
        }

        if (Math.abs(this.touchDeltaX) > this.swipeThreshold) {
            if (this.touchDeltaX > 0) {
                this.prevScreen();
            } else {
                this.nextScreen();
            }
        } else {
            // Snap back to current screen
            this.updateActiveScreen();
        }

        this.isSwiping = false;
        this.touchDeltaX = 0;
    }

    private handleClick(e: Event): void {
        const target = e.target as HTMLElement;
        const dot = target.closest('.carousel__dot') as HTMLElement;
        if (dot) {
            const index = parseInt(dot.dataset.index || '0', 10);
            const direction = index > this.activeIndex ? 'next' : 'prev';
            this.goToScreen(index, direction);
        }
    }

    private handleKeydown(e: KeyboardEvent): void {
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.prevScreen();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextScreen();
                break;
        }
    }

    private dispatchScreenChange(direction: 'next' | 'prev' | 'direct'): void {
        const screen = this.getActiveScreen();
        if (!screen) return;

        const event = new CustomEvent<ScreenChangeEvent>('screen-change', {
            detail: {
                screenIndex: this.activeIndex,
                screen,
                direction,
            },
            bubbles: true,
            composed: true,
        });

        this.dispatchEvent(event);
    }

    // ========================================================================
    // Styles
    // ========================================================================

    private getStyles(): string {
        return `
            :host {
                display: block;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            .carousel {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            .carousel--empty {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-muted, #888);
            }

            .carousel__track {
                display: flex;
                height: calc(100% - 40px);
                transition: transform 0.3s ease-out;
                will-change: transform;
            }

            .carousel__slide {
                flex: 0 0 100%;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            .carousel__slide > * {
                width: 100%;
                height: 100%;
            }

            /* Screen indicator */
            .carousel__indicator {
                display: flex;
                justify-content: center;
                gap: 8px;
                padding: 8px;
                height: 32px;
                background: var(--surface-color, #1a1a2e);
            }

            .carousel__dot {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 24px;
                padding: 0;
                border: none;
                border-radius: 12px;
                background: var(--dot-bg, rgba(255, 255, 255, 0.2));
                color: var(--dot-color, rgba(255, 255, 255, 0.6));
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 12px;
            }

            .carousel__dot:hover {
                background: var(--dot-hover-bg, rgba(255, 255, 255, 0.3));
            }

            .carousel__dot--active {
                background: var(--primary-color, #4ecdc4);
                color: var(--primary-text, #000);
                width: 48px;
            }

            .carousel__dot-icon {
                font-size: 14px;
            }

            /* Hide indicator for single screen */
            .carousel__indicator:has(.carousel__dot:only-child) {
                display: none;
            }

            /* Animation classes */
            .carousel__slide--entering {
                animation: slideIn 0.3s ease-out;
            }

            .carousel__slide--leaving {
                animation: slideOut 0.3s ease-out;
            }

            @keyframes slideIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }

            @keyframes slideOut {
                from { opacity: 1; transform: scale(1); }
                to { opacity: 0; transform: scale(0.95); }
            }

            /* Touch feedback */
            .carousel__track.is-dragging {
                cursor: grabbing;
            }

            /* Accessibility */
            .carousel__dot:focus {
                outline: 2px solid var(--focus-color, #4ecdc4);
                outline-offset: 2px;
            }

            .carousel__dot:focus:not(:focus-visible) {
                outline: none;
            }
        `;
    }
}

// ============================================================================
// Register Custom Element
// ============================================================================

if (!customElements.get('bpt-screen-carousel')) {
    customElements.define('bpt-screen-carousel', ScreenCarouselComponent);
}

export default ScreenCarouselComponent;
