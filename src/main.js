import { initTimerDisplay } from './ui/time.js';
import { initDiscardButton, initExportButton } from './ui/menu.js';
import { initMetricsDisplay } from './initMetricsDisplay.js';
import { initConnectionButtons } from './initConnectionButtons.js';
import { getInitState } from './getInitState.js';
import { handleWakeLock } from './ui/wakeLock.js';
import { registerServiceWorker } from './ui/serviceWorker.js';
import { initInstallPrompt } from './ui/installPrompt.js';
import { exposeVariablesDuringTest } from './exposeVariablesDuringTest.js';

const { measurementsState, connectionsState, timeState } = getInitState();
exposeVariablesDuringTest({ measurementsState, connectionsState });

initTimerDisplay(timeState);
initMetricsDisplay({ connectionsState, measurementsState });

initConnectionButtons({ connectionsState, measurementsState });
initDiscardButton({ measurementsState, timeState });
initExportButton(measurementsState);

handleWakeLock();
registerServiceWorker();
initInstallPrompt();
