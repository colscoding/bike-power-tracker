import { connectCadence } from './connect-cadence';
import { connectHeartRate } from './connect-heartrate';
import { connectPower } from './connect-power';
import { elements } from './elements';

export const initConnectionButtons = ({ connectionsState, measurementsState }) => {
    const metricTypes = ['power', 'heartrate', 'cadence'];
    const emojis = {
        power: '⚡',
        heartrate: '❤️',
        cadence: '🚴',
    };

    const disconnectFn = (key) => {
        if (typeof connectionsState[key].disconnect === 'function') {
            connectionsState[key].disconnect();
            connectionsState[key].disconnect = null;
            connectionsState[key].isConnected = false;
            const connectElem = elements[key]?.connect;
            if (connectElem?.textContent) {
                connectElem.textContent = `${emojis[key]} Connect ${key.charAt(0).toUpperCase() + key.slice(1)}`;
            }
            const displayElem = elements?.[key]?.display;
            if (displayElem?.textContent) {
                displayElem.textContent = '--';
            }
        }
    };

    const connectFn = async (key) => {
        const connectFns = {
            power: connectPower,
            heartrate: connectHeartRate,
            cadence: connectCadence,
        };
        try {
            const { disconnect, addListener } = await connectFns[key]();

            connectionsState[key].disconnect = disconnect;
            connectionsState[key].isConnected = true;

            addListener((entry) => {
                measurementsState.add(key, entry);
            });

            const connectElem = elements[key]?.connect;
            if (connectElem?.textContent) {
                connectElem.textContent = `${emojis[key]} Disconnect ${key.charAt(0).toUpperCase() + key.slice(1)}`;
            }
        } catch (error) {
            console.error(`Error connecting ${key}:`, error);
        }
    };

    metricTypes.forEach((key) => {
        const connectElem = elements[key]?.connect;
        if (connectElem) {
            connectElem.addEventListener('click', async () => {
                if (connectionsState[key].isConnected) {
                    disconnectFn(key);
                } else {
                    connectFn(key);
                }
            });
        }
    });
};
