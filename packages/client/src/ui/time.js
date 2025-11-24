import { getTimestring } from '../getTimestring.js';

export const initTimerDisplay = (timeState) => {
    const startStopButton = document.getElementById('startStop');
    const timeElement = document.getElementById('time');
    const metricsTable = document.getElementById('metricsTable');

    setInterval(() => {
        let nextText = '00:00:00'
        if (timeState.startTime && timeState.running) {
            const elapsedMs = Date.now() - timeState.startTime;
            nextText = getTimestring(elapsedMs);
        } else if (timeState.startTime && timeState.endTime) {
            const elapsedMs = timeState.endTime - timeState.startTime;
            nextText = getTimestring(elapsedMs);
        }
        if (timeElement.textContent !== nextText) {
            timeElement.textContent = nextText;
        }

        const nextStartButtonText = timeState.running ? '⏹️' : '▶️';
        if (startStopButton.textContent !== nextStartButtonText) {
            startStopButton.textContent = nextStartButtonText;
        }

        // Update metrics table styling based on running state
        if (timeState.running) {
            metricsTable.classList.remove('paused');
        } else {
            metricsTable.classList.add('paused');
        }
    }, 100);

    startStopButton.addEventListener('click', () => {
        if (timeState.running) {
            // Stop the workout (pause it, don't reset)
            timeState.running = false;
            timeState.endTime = Date.now();

            // Change button to start
            startStopButton.textContent = '▶️';
        } else {
            // Start/Resume the workout
            if (timeState.endTime) {
                // Resuming - adjust startTime to account for time stopped
                const stoppedDuration = Date.now() - timeState.endTime;
                timeState.startTime += stoppedDuration;
                timeState.endTime = null;
            } else {
                // Starting fresh
                timeState.startTime = Date.now();
            }
            timeState.running = true;
            startStopButton.textContent = '⏹️';
        }
    });
}