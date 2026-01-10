/**
 * Connection Error UI Module
 * 
 * Displays user-friendly error messages for Bluetooth connection failures
 * with troubleshooting suggestions and retry functionality.
 * 
 * @module connectionError
 */

import { showModal } from './modal.js';
import { announce } from './accessibility.js';
import type { MeasurementType } from '../types/measurements.js';

/**
 * Bluetooth error codes and their user-friendly messages
 */
interface ErrorInfo {
    title: string;
    message: string;
    suggestions: string[];
    canRetry: boolean;
}

/**
 * Sensor type display names
 */
const sensorLabels: Record<MeasurementType | 'treadmill', string> = {
    power: 'Power Meter',
    heartrate: 'Heart Rate Monitor',
    cadence: 'Cadence Sensor',
    speed: 'Speed Sensor',
    distance: 'Distance Sensor',
    altitude: 'Altimeter',
    gps: 'GPS',
    treadmill: 'Treadmill',
    treadmillSpeed: 'Treadmill Speed',
    energy: 'Energy',
};

/**
 * Sensor type icons
 */
const sensorIcons: Record<MeasurementType | 'treadmill', string> = {
    power: '⚡',
    heartrate: '❤️',
    cadence: '🚴',
    speed: '💨',
    distance: '📏',
    altitude: '🏔️',
    gps: '📍',
    treadmill: '🏃',
    treadmillSpeed: '🏃',
    energy: '🔥'
};

/**
 * Parse a Bluetooth error and return user-friendly information
 */
function parseBluetoothError(error: unknown, sensorType: MeasurementType | 'treadmill'): ErrorInfo {
    const sensorLabel = sensorLabels[sensorType];
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';

    // User cancelled the device selection
    if (errorMessage.includes('User cancelled') || errorMessage.includes('cancelled the requestDevice')) {
        return {
            title: 'Connection Cancelled',
            message: `${sensorLabel} pairing was cancelled.`,
            suggestions: [
                'Click the connect button to try again',
                'Make sure your sensor is powered on and in range',
            ],
            canRetry: true,
        };
    }

    // Bluetooth not available
    if (errorMessage.includes('Bluetooth adapter not available') ||
        errorMessage.includes('Web Bluetooth API is not available') ||
        errorName === 'NotFoundError' && errorMessage.includes('Bluetooth')) {
        return {
            title: 'Bluetooth Unavailable',
            message: 'Bluetooth is not available on this device or browser.',
            suggestions: [
                'Check that Bluetooth is enabled in your device settings',
                'Try using Chrome, Edge, or another browser that supports Web Bluetooth',
                'On macOS, ensure Bluetooth permissions are granted in System Preferences',
                'On Windows, check that your Bluetooth adapter is working',
            ],
            canRetry: false,
        };
    }

    // No devices found
    if (errorMessage.includes('No Bluetooth devices') ||
        errorMessage.includes('No devices found') ||
        (errorName === 'NotFoundError' && !errorMessage.includes('Bluetooth'))) {
        return {
            title: 'No Sensors Found',
            message: `No compatible ${sensorLabel.toLowerCase()} was found nearby.`,
            suggestions: [
                'Make sure your sensor is powered on',
                'Wake up the sensor by spinning the pedals or moving',
                'Bring the sensor closer to your device',
                'Check that the sensor battery is not depleted',
                'Ensure the sensor is not connected to another device',
            ],
            canRetry: true,
        };
    }

    // GATT connection failed
    if (errorMessage.includes('GATT') ||
        errorMessage.includes('Connection failed') ||
        errorMessage.includes('connect') && errorMessage.includes('fail')) {
        return {
            title: 'Connection Failed',
            message: `Could not connect to the ${sensorLabel.toLowerCase()}.`,
            suggestions: [
                'Try moving closer to the sensor',
                'Power cycle the sensor (turn off and on again)',
                'Check that no other device is connected to this sensor',
                'Restart Bluetooth on your device',
                'If using a phone, try closing other Bluetooth apps',
            ],
            canRetry: true,
        };
    }

    // Security/permission error
    if (errorMessage.includes('SecurityError') ||
        errorMessage.includes('permission') ||
        errorName === 'SecurityError') {
        return {
            title: 'Permission Denied',
            message: 'Bluetooth permission was denied.',
            suggestions: [
                'Check your browser settings to allow Bluetooth access',
                'If prompted, click "Allow" to grant Bluetooth permission',
                'Try refreshing the page and connecting again',
                'On some browsers, you may need to access this site over HTTPS',
            ],
            canRetry: true,
        };
    }

    // Network/timeout error
    if (errorMessage.includes('NetworkError') ||
        errorMessage.includes('timeout') ||
        errorName === 'NetworkError') {
        return {
            title: 'Connection Timed Out',
            message: `The connection to your ${sensorLabel.toLowerCase()} timed out.`,
            suggestions: [
                'Make sure the sensor is in range and powered on',
                'Try moving closer to the sensor',
                'Power cycle the sensor and try again',
                'Check for interference from other wireless devices',
            ],
            canRetry: true,
        };
    }

    // Service not found
    if (errorMessage.includes('Service') && errorMessage.includes('not found')) {
        return {
            title: 'Incompatible Sensor',
            message: `This device doesn't appear to be a compatible ${sensorLabel.toLowerCase()}.`,
            suggestions: [
                'Make sure you selected the correct sensor type',
                'Check that your sensor supports standard Bluetooth protocols',
                'Some sensors may require a firmware update',
                'Consult your sensor\'s documentation for compatibility',
            ],
            canRetry: true,
        };
    }

    // Generic/unknown error
    return {
        title: 'Connection Error',
        message: `Failed to connect to ${sensorLabel.toLowerCase()}.`,
        suggestions: [
            'Make sure the sensor is powered on and nearby',
            'Try power cycling the sensor',
            'Restart Bluetooth on your device',
            'Refresh the page and try again',
        ],
        canRetry: true,
    };
}

/**
 * Create the error content HTML element
 */
function createErrorContent(errorInfo: ErrorInfo): HTMLElement {
    const container = document.createElement('div');
    container.className = 'connection-error-content';

    // Error message
    const messageEl = document.createElement('p');
    messageEl.className = 'connection-error-message';
    messageEl.textContent = errorInfo.message;
    container.appendChild(messageEl);

    // Troubleshooting section
    if (errorInfo.suggestions.length > 0) {
        const troubleshootingEl = document.createElement('div');
        troubleshootingEl.className = 'connection-error-troubleshooting';

        const titleEl = document.createElement('h3');
        titleEl.textContent = '💡 Troubleshooting Tips';
        troubleshootingEl.appendChild(titleEl);

        const listEl = document.createElement('ul');
        listEl.setAttribute('role', 'list');
        errorInfo.suggestions.forEach(suggestion => {
            const itemEl = document.createElement('li');
            itemEl.textContent = suggestion;
            listEl.appendChild(itemEl);
        });
        troubleshootingEl.appendChild(listEl);

        container.appendChild(troubleshootingEl);
    }

    return container;
}

/**
 * Show a connection error dialog with troubleshooting suggestions
 * 
 * @param error - The error that occurred
 * @param sensorType - The type of sensor that failed to connect
 * @param onRetry - Optional callback for retry button
 * @returns Promise resolving to true if user wants to retry, false otherwise
 */
export function showConnectionError(
    error: unknown,
    sensorType: MeasurementType | 'treadmill',
    onRetry?: () => void
): Promise<boolean> {
    return new Promise((resolve) => {
        const errorInfo = parseBluetoothError(error, sensorType);
        const sensorIcon = sensorIcons[sensorType];
        const content = createErrorContent(errorInfo);

        // Log the actual error for debugging
        console.error(`[${sensorType}] Connection error:`, error);

        // Announce to screen readers
        announce(`${errorInfo.title}. ${errorInfo.message}`, 'assertive');

        let closeModal: (() => void) | null = null;

        const buttons = [];

        // Always add a dismiss button
        buttons.push({
            text: 'Dismiss',
            variant: 'secondary' as const,
            onClick: () => {
                closeModal?.();
                resolve(false);
            },
        });

        // Add retry button if applicable
        if (errorInfo.canRetry) {
            buttons.push({
                text: 'Try Again',
                variant: 'primary' as const,
                onClick: () => {
                    closeModal?.();
                    if (onRetry) {
                        onRetry();
                    }
                    resolve(true);
                },
            });
        }

        closeModal = showModal({
            title: errorInfo.title,
            icon: sensorIcon,
            content,
            buttons,
            closeOnOverlay: true,
            onClose: () => resolve(false),
        });
    });
}

/**
 * Show a reconnection failure notification
 * 
 * Called when auto-reconnect has exhausted all attempts.
 * 
 * @param sensorType - The type of sensor that failed to reconnect
 * @param onRetry - Optional callback to manually retry connection
 */
export function showReconnectionFailed(
    sensorType: MeasurementType | 'treadmill',
    onRetry?: () => void
): void {
    const sensorLabel = sensorLabels[sensorType];
    const sensorIcon = sensorIcons[sensorType];

    const content = document.createElement('div');
    content.className = 'connection-error-content';

    const messageEl = document.createElement('p');
    messageEl.className = 'connection-error-message';
    messageEl.textContent = `Lost connection to your ${sensorLabel.toLowerCase()} and automatic reconnection failed.`;
    content.appendChild(messageEl);

    const tipsEl = document.createElement('div');
    tipsEl.className = 'connection-error-troubleshooting';

    const titleEl = document.createElement('h3');
    titleEl.textContent = '💡 To reconnect:';
    tipsEl.appendChild(titleEl);

    const listEl = document.createElement('ul');
    listEl.setAttribute('role', 'list');
    [
        'Make sure the sensor is still powered on',
        'Move closer to the sensor',
        'Click "Try Again" to reconnect manually',
    ].forEach(tip => {
        const itemEl = document.createElement('li');
        itemEl.textContent = tip;
        listEl.appendChild(itemEl);
    });
    tipsEl.appendChild(listEl);
    content.appendChild(tipsEl);

    announce(`${sensorLabel} connection lost. Automatic reconnection failed.`, 'assertive');

    let closeModal: (() => void) | null = null;

    closeModal = showModal({
        title: 'Connection Lost',
        icon: sensorIcon,
        content,
        buttons: [
            {
                text: 'Dismiss',
                variant: 'secondary',
                onClick: () => {
                    closeModal?.();
                },
            },
            {
                text: 'Try Again',
                variant: 'primary',
                onClick: () => {
                    closeModal?.();
                    onRetry?.();
                },
            },
        ],
        closeOnOverlay: true,
    });
}
