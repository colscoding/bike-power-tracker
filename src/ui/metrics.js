export const startMetricUpdates = () => {

    const metricTypes = ['power', 'heartrate', 'cadence'];

    const powerElement = document.getElementById('power');
    const heartrateElement = document.getElementById('heartrate');
    const cadenceElement = document.getElementById('cadence');

    const connectPowerElem = document.getElementById('connectPower');
    const connectHeartrateElem = document.getElementById('connectHeartrate');
    const connectCadenceElem = document.getElementById('connectCadence');

    const elements = {
        power: { display: powerElement, connect: connectPowerElem },
        heartrate: { display: heartrateElement, connect: connectHeartrateElem },
        cadence: { display: cadenceElement, connect: connectCadenceElem },
    }

    const updateMetricDisplay = (key) => {
        const element = elements?.[key]?.display;
        if (!element || !connectionsState?.[key]) {
            return;
        }
        const emptyValue = '--';
        if (!connectionsState?.[key]?.isConnected) {
            element.textContent = emptyValue;
            return;
        }
        const arr = measurementsState[key];
        if (!Array.isArray(arr) || arr.length === 0) {
            element.textContent = emptyValue;
            return;
        }

        const latestMeasurement = arr[arr.length - 1];
        if (!latestMeasurement || typeof latestMeasurement.value !== 'number' || typeof latestMeasurement.timestamp !== 'number') {
            element.textContent = emptyValue;
            return;
        }
        const timeDiff = Date.now() - latestMeasurement.timestamp;
        // If data is older than 5 seconds, show as disconnected
        if (timeDiff > 5000) {
            element.textContent = emptyValue;
            return;
        }

        element.textContent = latestMeasurement.value;
    }

    // Start the event loop
    setInterval(() => {
        metricTypes.forEach(updateMetricDisplay);
    }, 100);

};