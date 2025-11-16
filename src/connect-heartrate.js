
export const connectHeartRateMock = async () => {
    const listeners = [];
    const heartRateInterval = setInterval(() => {
        const randomHeartRate = Math.floor(Math.random() * 80) + 120; // 120-200 bpm
        const entry = { timestamp: Date.now(), value: randomHeartRate };
        listeners.forEach(listener => listener(entry));
    }, 1000);

    return {
        disconnect: () => clearInterval(heartRateInterval),
        addListener: (callback) => {
            listeners.push(callback);
        }
    };
}

export const connectHeartRateBluetooth = async () => {
    const listeners = [];

    // Request Bluetooth device with heart rate service
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['heart_rate']
    });

    // Connect to GATT server
    const server = await device.gatt.connect();

    // Get heart rate service
    const service = await server.getPrimaryService('heart_rate');

    // Get heart rate measurement characteristic
    const characteristic = await service.getCharacteristic('heart_rate_measurement');

    // Start notifications
    await characteristic.startNotifications();

    // Listen for heart rate changes
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        // Heart rate measurement format: first byte contains flags, second byte is heart rate
        const heartRate = value.getUint8(1);
        const entry = { timestamp: Date.now(), value: heartRate };
        listeners.forEach(listener => listener(entry));
    });

    return {
        disconnect: () => {
            characteristic.stopNotifications();
            device.gatt.disconnect();
        },
        addListener: (callback) => {
            listeners.push(callback);
        }
    };
}

export const connectHeartRate = async () => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectHeartRateMock();
    }
    // Production implementation would go here
    return connectHeartRateBluetooth();
};