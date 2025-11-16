import { getCsvString } from "../create-csv";
import { getTcxString } from "../create-tcx";

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