/**
 * DOM element references used throughout the application
 */

/**
 * Metrics display elements
 */
export interface MetricsElements {
    powerValue: HTMLElement | null;
    cadenceValue: HTMLElement | null;
    heartrateValue: HTMLElement | null;
    powerStatus: HTMLElement | null;
    cadenceStatus: HTMLElement | null;
    heartrateStatus: HTMLElement | null;
}

/**
 * Connection button elements
 */
export interface ConnectionButtonElements {
    powerButton: HTMLButtonElement | null;
    cadenceButton: HTMLButtonElement | null;
    heartrateButton: HTMLButtonElement | null;
}

/**
 * Timer display elements
 */
export interface TimerElements {
    timerDisplay: HTMLElement | null;
    startButton: HTMLButtonElement | null;
    pauseButton: HTMLButtonElement | null;
    stopButton: HTMLButtonElement | null;
}

/**
 * Menu elements
 */
export interface MenuElements {
    exportButton: HTMLButtonElement | null;
    discardButton: HTMLButtonElement | null;
    settingsButton: HTMLButtonElement | null;
}

/**
 * Stream control elements
 */
export interface StreamControlElements {
    streamButton: HTMLButtonElement | null;
    streamStatus: HTMLElement | null;
    streamNameInput: HTMLInputElement | null;
    serverUrlInput: HTMLInputElement | null;
}

/**
 * All application DOM elements
 */
export interface AppElements {
    metrics: MetricsElements;
    connections: ConnectionButtonElements;
    timer: TimerElements;
    menu: MenuElements;
    stream: StreamControlElements;
}
