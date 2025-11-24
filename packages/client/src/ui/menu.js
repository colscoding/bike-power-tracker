import { getCsvString } from "../create-csv";
import { getTcxString } from "../create-tcx";

export const initMetricsToggle = () => {
    // Your Metrics Toggle
    const toggleYour = document.getElementById('toggleYourMetrics');
    const yourMetricsSection = document.getElementById('yourMetrics');

    if (toggleYour && yourMetricsSection) {
        // Initial state check
        toggleYour.checked = yourMetricsSection.style.display !== 'none';

        toggleYour.addEventListener('change', (e) => {
            const show = e.target.checked;
            yourMetricsSection.style.display = show ? 'flex' : 'none';
        });
    }

    // Stream Metrics Toggle
    const toggleStream = document.getElementById('toggleStreamMetrics');
    const streamMetricsSection = document.getElementById('streamMetrics');
    const closeStreamBtn = document.getElementById('closeStreamView');

    if (toggleStream && streamMetricsSection) {
        // Initial state check
        toggleStream.checked = streamMetricsSection.style.display !== 'none';

        toggleStream.addEventListener('change', (e) => {
            const show = e.target.checked;
            streamMetricsSection.style.display = show ? 'flex' : 'none';

            // If we're hiding it via toggle, we might want to disconnect? 
            // Or just hide the view? The user request implies just show/hide like the other one.
            // However, the stream view usually implies a connection. 
            // If the user toggles it ON, and there is no connection, it will show empty data.
            // If the user toggles it OFF, the connection might persist in background?
            // For now, let's just toggle visibility.
        });
    }
}

export const initDiscardButton = ({ measurementsState, timeState }) => {
    // Discard button - in menu with confirmation dialog
    const discardButton = document.getElementById('discardButton');
    discardButton.addEventListener('click', () => {
        // Show confirmation dialog
        if (confirm('Are you sure you want to discard this workout?')) {
            // Reset time state
            timeState.running = false;
            timeState.startTime = null;
            timeState.endTime = null;

            // Reset measurements
            measurementsState.power = [];
            measurementsState.heartrate = [];
            measurementsState.cadence = [];
        }
    });
}

export const initExportButton = (measurementsState) => {
    const exportDataElem = document.getElementById('exportData');
    exportDataElem.addEventListener('click', () => {
        try {
            const now = new Date();
            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

            // Create export data object with all measurements
            const exportData = {
                power: measurementsState.power,
                heartrate: measurementsState.heartrate,
                cadence: measurementsState.cadence,
            };

            // Download JSON file
            const jsonString = JSON.stringify(exportData, null, 2);
            const jsonBlob = new Blob([jsonString], { type: 'application/json' });
            const jsonUrl = URL.createObjectURL(jsonBlob);
            const jsonLink = document.createElement('a');
            jsonLink.href = jsonUrl;
            jsonLink.download = `bike-measurements-${timestamp}.json`;
            jsonLink.click();
            URL.revokeObjectURL(jsonUrl);

            // Download TCX file
            const tcxString = getTcxString(measurementsState);
            const tcxBlob = new Blob([tcxString], { type: 'application/xml' });
            const tcxUrl = URL.createObjectURL(tcxBlob);
            const tcxLink = document.createElement('a');
            tcxLink.href = tcxUrl;
            tcxLink.download = `bike-workout-${timestamp}.tcx`;
            tcxLink.click();
            URL.revokeObjectURL(tcxUrl);

            // Download CSV file
            const csvString = getCsvString(measurementsState);
            const csvBlob = new Blob([csvString], { type: 'text/csv' });
            const csvUrl = URL.createObjectURL(csvBlob);
            const csvLink = document.createElement('a');
            csvLink.href = csvUrl;
            csvLink.download = `bike-workout-${timestamp}.csv`;
            csvLink.click();
            URL.revokeObjectURL(csvUrl);
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    });
};