import { logBluetoothError } from '../ErrorLogger.js';
import { showError } from '../../ui/ToastManager.js';

export enum BluetoothErrorCode {
    NOT_SUPPORTED = 'NOT_SUPPORTED',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
    CONNECTION_FAILED = 'CONNECTION_FAILED',
    CONNECTION_LOST = 'CONNECTION_LOST',
    SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
    CHARACTERISTIC_NOT_FOUND = 'CHARACTERISTIC_NOT_FOUND',
    NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
    TIMEOUT = 'TIMEOUT',
    UNKNOWN = 'UNKNOWN',
}

export interface BluetoothErrorInfo {
    code: BluetoothErrorCode;
    originalError?: Error;
    deviceName?: string;
    context?: Record<string, unknown>;
}

const ERROR_MESSAGES: Record<BluetoothErrorCode, { user: string; technical: string }> = {
    [BluetoothErrorCode.NOT_SUPPORTED]: {
        user: 'Bluetooth is not supported on this device or browser.',
        technical: 'Web Bluetooth API not available',
    },
    [BluetoothErrorCode.PERMISSION_DENIED]: {
        user: 'Bluetooth permission was denied. Please allow Bluetooth access in your browser settings.',
        technical: 'User denied Bluetooth permission',
    },
    [BluetoothErrorCode.DEVICE_NOT_FOUND]: {
        user: 'No compatible sensor found. Make sure your sensor is powered on and in range.',
        technical: 'No device selected or found during scan',
    },
    [BluetoothErrorCode.CONNECTION_FAILED]: {
        user: 'Failed to connect to sensor. Please try again.',
        technical: 'GATT connection failed',
    },
    [BluetoothErrorCode.CONNECTION_LOST]: {
        user: 'Sensor connection lost. Attempting to reconnect...',
        technical: 'GATT server disconnected',
    },
    [BluetoothErrorCode.SERVICE_NOT_FOUND]: {
        user: 'Sensor is not compatible. Required service not found.',
        technical: 'Required GATT service not found',
    },
    [BluetoothErrorCode.CHARACTERISTIC_NOT_FOUND]: {
        user: 'Sensor is not compatible. Required data not available.',
        technical: 'Required GATT characteristic not found',
    },
    [BluetoothErrorCode.NOTIFICATION_FAILED]: {
        user: 'Unable to receive data from sensor.',
        technical: 'Failed to start notifications',
    },
    [BluetoothErrorCode.TIMEOUT]: {
        user: 'Connection timed out. Please try again.',
        technical: 'Operation timed out',
    },
    [BluetoothErrorCode.UNKNOWN]: {
        user: 'An unexpected error occurred with the sensor.',
        technical: 'Unknown Bluetooth error',
    },
};

export function parseBluetoothError(error: Error): BluetoothErrorCode {
    const message = error.message.toLowerCase();

    if (message.includes('bluetooth') && message.includes('not')) {
        return BluetoothErrorCode.NOT_SUPPORTED;
    }

    if (message.includes('permission') || message.includes('denied') || message.includes('cancelled')) {
        return BluetoothErrorCode.PERMISSION_DENIED;
    }

    if (message.includes('no device') || message.includes('not found')) {
        return BluetoothErrorCode.DEVICE_NOT_FOUND;
    }

    if (message.includes('connect') && message.includes('fail')) {
        return BluetoothErrorCode.CONNECTION_FAILED;
    }

    if (message.includes('disconnect') || message.includes('lost')) {
        return BluetoothErrorCode.CONNECTION_LOST;
    }

    if (message.includes('service')) {
        return BluetoothErrorCode.SERVICE_NOT_FOUND;
    }

    if (message.includes('characteristic')) {
        return BluetoothErrorCode.CHARACTERISTIC_NOT_FOUND;
    }

    if (message.includes('notification')) {
        return BluetoothErrorCode.NOTIFICATION_FAILED;
    }

    if (message.includes('timeout')) {
        return BluetoothErrorCode.TIMEOUT;
    }

    return BluetoothErrorCode.UNKNOWN;
}

export function handleBluetoothError(info: BluetoothErrorInfo): void {
    const messages = ERROR_MESSAGES[info.code];

    // Log technical error
    logBluetoothError(messages.technical, {
        code: info.code,
        deviceName: info.deviceName,
        originalError: info.originalError?.message,
        ...info.context,
    });

    // Show user-friendly message
    showError(messages.user, info.code === BluetoothErrorCode.CONNECTION_LOST ? {
        dismissible: true
        // Action support in ToastManager is not fully implemented yet in my version
        // The plan had "action" prop in ToastOptions.
        // My ToastManager (based on Component) supports dismissible.
        // I should probably add support for action/button to Toast component if needed.
        // For now, I'll omit action.
    } : undefined);
}

/**
 * Wrap async Bluetooth operations with timeout and error handling
 */
export async function withBluetoothErrorHandling<T>(
    operation: () => Promise<T>,
    options: {
        timeout?: number;
        deviceName?: string;
        context?: Record<string, unknown>;
    } = {}
): Promise<T> {
    const { timeout = 10000, deviceName, context } = options;

    try {
        const result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Operation timed out')), timeout);
            }),
        ]);

        return result;
    } catch (error) {
        const code = error instanceof Error
            ? parseBluetoothError(error)
            : BluetoothErrorCode.UNKNOWN;

        handleBluetoothError({
            code,
            originalError: error instanceof Error ? error : undefined,
            deviceName,
            context,
        });

        throw error;
    }
}
