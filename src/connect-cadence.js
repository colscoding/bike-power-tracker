export const connectCadenceMock = async () => {
    const listeners = [];
    const cadenceInterval = setInterval(() => {
        const randomCadence = Math.floor(Math.random() * 40) + 70; // 70-110 rpm
        const entry = { timestamp: Date.now(), value: randomCadence };
        listeners.forEach(listener => listener(entry));
    }, 1000);

    return {
        disconnect: () => clearInterval(cadenceInterval),
        addListener: (callback) => {
            listeners.push(callback);
        }
    };
}

export const connectCadenceBluetooth = async () => {
    const listeners = [];
    let lastCrankRevs = null;
    let lastCrankTime = null;

    // Request Bluetooth device with cycling speed and cadence service
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['cycling_speed_and_cadence'] }],
        optionalServices: ['cycling_speed_and_cadence']
    });

    // Connect to GATT server
    const server = await device.gatt.connect();

    // Get cycling speed and cadence service
    const service = await server.getPrimaryService('cycling_speed_and_cadence');

    // Get CSC measurement characteristic
    const characteristic = await service.getCharacteristic('csc_measurement');

    // Start notifications
    await characteristic.startNotifications();

    // Listen for cadence changes
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        const flags = value.getUint8(0);

        // Check if crank revolution data is present (bit 1 of flags)
        if (flags & 0x02) {
            // Crank revolution data format:
            // - Cumulative Crank Revolutions (uint16, bytes 1-2 or 5-6 depending on wheel data)
            // - Last Crank Event Time (uint16, bytes 3-4 or 7-8, units: 1/1024 seconds)

            let offset = 1; // Start after flags byte

            // If wheel revolution data is present (bit 0), skip it (4 bytes)
            if (flags & 0x01) {
                offset = 5;
            }

            const crankRevs = value.getUint16(offset, true);
            const crankTime = value.getUint16(offset + 2, true); // Units: 1/1024 seconds

            // Calculate RPM from delta between measurements
            if (lastCrankRevs !== null && lastCrankTime !== null) {
                let revDelta = crankRevs - lastCrankRevs;
                let timeDelta = crankTime - lastCrankTime;

                // Handle rollover (uint16 max is 65535)
                if (revDelta < 0) revDelta += 65536;
                if (timeDelta < 0) timeDelta += 65536;

                // Calculate RPM: (revolutions / time_in_seconds) * 60
                // Time is in 1/1024 seconds, so convert to seconds
                if (timeDelta > 0) {
                    const timeInSeconds = timeDelta / 1024;
                    const rpm = Math.round((revDelta / timeInSeconds) * 60);

                    // Sanity check for reasonable cadence values
                    if (rpm > 0 && rpm < 300) {
                        const entry = { timestamp: Date.now(), value: rpm };
                        listeners.forEach(listener => listener(entry));
                    }
                }
            }

            lastCrankRevs = crankRevs;
            lastCrankTime = crankTime;
        }
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

export const connectCadence = async () => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectCadenceMock();
    }
    return connectCadenceBluetooth();
};
