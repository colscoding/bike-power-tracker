import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';

// Mock Capacitor
const isNativeMock = mock.fn(() => false);
mock.module('@capacitor/core', {
    namedExports: {
        Capacitor: {
            isNativePlatform: isNativeMock
        }
    }
});

// Mock implementation object
const mockConnection = { disconnect: () => { }, addListener: () => { } };

// Mutable mock references
let mocks = {
    connectPowerWeb: mock.fn(async (..._args: any[]) => mockConnection),
    connectHeartRateWeb: mock.fn(async (..._args: any[]) => mockConnection),
    connectCadenceWeb: mock.fn(async (..._args: any[]) => mockConnection),
    connectTreadmillWeb: mock.fn(async (..._args: any[]) => mockConnection),

    connectPowerNative: mock.fn(async (..._args: any[]) => mockConnection),
    connectHeartRateNative: mock.fn(async (..._args: any[]) => mockConnection),
    connectCadenceNative: mock.fn(async (..._args: any[]) => mockConnection),
    connectTreadmillNative: mock.fn(async (..._args: any[]) => mockConnection)
};

// Mock Web Bluetooth
mock.module('../../src/services/bluetooth/web-bluetooth.js', {
    namedExports: {
        connectPowerWeb: (...args: any[]) => mocks.connectPowerWeb(...args),
        connectHeartRateWeb: (...args: any[]) => mocks.connectHeartRateWeb(...args),
        connectCadenceWeb: (...args: any[]) => mocks.connectCadenceWeb(...args),
        connectTreadmillWeb: (...args: any[]) => mocks.connectTreadmillWeb(...args)
    }
});

// Mock Native Bluetooth
mock.module('../../src/services/bluetooth/native-bluetooth.js', {
    namedExports: {
        connectPowerNative: (...args: any[]) => mocks.connectPowerNative(...args),
        connectHeartRateNative: (...args: any[]) => mocks.connectHeartRateNative(...args),
        connectCadenceNative: (...args: any[]) => mocks.connectCadenceNative(...args),
        connectTreadmillNative: (...args: any[]) => mocks.connectTreadmillNative(...args)
    }
});

describe('BluetoothFactory', () => {
    let BluetoothFactory: any;

    // We don't need to import webModule/nativeModule anymore to check calls, 
    // we can check our 'mocks' object directly.

    before(async () => {
        const factoryModule = await import('../../src/services/bluetooth/factory.js');
        BluetoothFactory = factoryModule.BluetoothFactory;
    });

    afterEach(() => {
        // Reset call history by creating new mocks or clearing
        // mocks.connectPowerWeb.mock.reset(); // If available
        // Or just re-assign
        mocks.connectPowerWeb = mock.fn(async () => mockConnection);
        mocks.connectHeartRateWeb = mock.fn(async () => mockConnection);

        mocks.connectPowerNative = mock.fn(async () => mockConnection);
        mocks.connectHeartRateNative = mock.fn(async () => mockConnection);
        // ... (others)
    });

    it('should use Web implementations when on Web', async () => {
        isNativeMock.mock.mockImplementation(() => false);

        await BluetoothFactory.connectPower();
        assert.strictEqual(mocks.connectPowerWeb.mock.calls.length, 1);
        assert.strictEqual(mocks.connectPowerNative.mock.calls.length, 0);

        await BluetoothFactory.connectHeartRate();
        assert.strictEqual(mocks.connectHeartRateWeb.mock.calls.length, 1);
        assert.strictEqual(mocks.connectHeartRateNative.mock.calls.length, 0);
    });

    it('should use Native implementations when on Native', async () => {
        isNativeMock.mock.mockImplementation(() => true);

        await BluetoothFactory.connectPower();
        assert.strictEqual(mocks.connectPowerNative.mock.calls.length, 1);
        assert.strictEqual(mocks.connectPowerWeb.mock.calls.length, 0);
    });
});
