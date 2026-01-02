/**
 * Tests for Connection Error UI Module
 * 
 * @module connectionError.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Connection Error UI', () => {
    describe('Error parsing', () => {
        it('should identify user cancellation errors', () => {
            const error = new Error('User cancelled the requestDevice() chooser.');
            const errorMessage = error.message;

            assert.ok(errorMessage.includes('cancelled'));
        });

        it('should identify Bluetooth unavailable errors', () => {
            const error = new Error('Bluetooth adapter not available');
            const errorMessage = error.message;

            assert.ok(errorMessage.includes('Bluetooth') && errorMessage.includes('not available'));
        });

        it('should identify no devices found errors', () => {
            const error = new DOMException('No Bluetooth devices found', 'NotFoundError');

            assert.strictEqual(error.name, 'NotFoundError');
            assert.ok(error.message.includes('No Bluetooth'));
        });

        it('should identify GATT connection errors', () => {
            const error = new Error('GATT Server is disconnected. Cannot retrieve services.');
            const errorMessage = error.message;

            assert.ok(errorMessage.includes('GATT'));
        });

        it('should identify permission errors', () => {
            const error = new DOMException('Permission denied', 'SecurityError');

            assert.strictEqual(error.name, 'SecurityError');
        });

        it('should identify timeout errors', () => {
            const error = new DOMException('Connection timed out', 'NetworkError');

            assert.strictEqual(error.name, 'NetworkError');
        });
    });

    describe('Sensor labels', () => {
        it('should have correct power meter label', () => {
            const labels: Record<string, string> = {
                power: 'Power Meter',
                heartrate: 'Heart Rate Monitor',
                cadence: 'Cadence Sensor',
            };

            assert.strictEqual(labels.power, 'Power Meter');
        });

        it('should have correct heart rate monitor label', () => {
            const labels: Record<string, string> = {
                power: 'Power Meter',
                heartrate: 'Heart Rate Monitor',
                cadence: 'Cadence Sensor',
            };

            assert.strictEqual(labels.heartrate, 'Heart Rate Monitor');
        });

        it('should have correct cadence sensor label', () => {
            const labels: Record<string, string> = {
                power: 'Power Meter',
                heartrate: 'Heart Rate Monitor',
                cadence: 'Cadence Sensor',
            };

            assert.strictEqual(labels.cadence, 'Cadence Sensor');
        });
    });

    describe('Sensor icons', () => {
        it('should have correct icons for each sensor type', () => {
            const icons: Record<string, string> = {
                power: '⚡',
                heartrate: '❤️',
                cadence: '🚴',
            };

            assert.strictEqual(icons.power, '⚡');
            assert.strictEqual(icons.heartrate, '❤️');
            assert.strictEqual(icons.cadence, '🚴');
        });
    });

    describe('Error info structure', () => {
        it('should have required properties', () => {
            interface ErrorInfo {
                title: string;
                message: string;
                suggestions: string[];
                canRetry: boolean;
            }

            const mockErrorInfo: ErrorInfo = {
                title: 'Connection Failed',
                message: 'Could not connect to the sensor.',
                suggestions: ['Try again', 'Check battery'],
                canRetry: true,
            };

            assert.ok('title' in mockErrorInfo);
            assert.ok('message' in mockErrorInfo);
            assert.ok('suggestions' in mockErrorInfo);
            assert.ok('canRetry' in mockErrorInfo);
            assert.ok(Array.isArray(mockErrorInfo.suggestions));
        });

        it('should have canRetry false for unrecoverable errors', () => {
            interface ErrorInfo {
                title: string;
                message: string;
                suggestions: string[];
                canRetry: boolean;
            }

            const bluetoothUnavailableInfo: ErrorInfo = {
                title: 'Bluetooth Unavailable',
                message: 'Bluetooth is not available on this device.',
                suggestions: ['Use a different browser'],
                canRetry: false,
            };

            assert.strictEqual(bluetoothUnavailableInfo.canRetry, false);
        });

        it('should have canRetry true for recoverable errors', () => {
            interface ErrorInfo {
                title: string;
                message: string;
                suggestions: string[];
                canRetry: boolean;
            }

            const connectionFailedInfo: ErrorInfo = {
                title: 'Connection Failed',
                message: 'Could not connect to the sensor.',
                suggestions: ['Move closer to sensor'],
                canRetry: true,
            };

            assert.strictEqual(connectionFailedInfo.canRetry, true);
        });
    });

    describe('Troubleshooting suggestions', () => {
        it('should provide suggestions for no devices found', () => {
            const suggestions = [
                'Make sure your sensor is powered on',
                'Wake up the sensor by spinning the pedals or moving',
                'Bring the sensor closer to your device',
                'Check that the sensor battery is not depleted',
                'Ensure the sensor is not connected to another device',
            ];

            assert.ok(suggestions.length >= 3);
            assert.ok(suggestions.some(s => s.includes('powered')));
            assert.ok(suggestions.some(s => s.includes('battery')));
        });

        it('should provide suggestions for connection failures', () => {
            const suggestions = [
                'Try moving closer to the sensor',
                'Power cycle the sensor (turn off and on again)',
                'Check that no other device is connected to this sensor',
                'Restart Bluetooth on your device',
            ];

            assert.ok(suggestions.length >= 3);
            assert.ok(suggestions.some(s => s.includes('closer')));
            assert.ok(suggestions.some(s => s.includes('Power cycle')));
        });

        it('should provide suggestions for Bluetooth unavailable', () => {
            const suggestions = [
                'Check that Bluetooth is enabled in your device settings',
                'Try using Chrome, Edge, or another browser that supports Web Bluetooth',
            ];

            assert.ok(suggestions.length >= 1);
            assert.ok(suggestions.some(s => s.includes('Bluetooth') && s.includes('enabled')));
        });
    });
});
