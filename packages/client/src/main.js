import './main.css';
import { initTimerDisplay } from './ui/time.js';
import { initDiscardButton, initExportButton, initMetricsToggle } from './ui/menu.js';
import { initMetricsDisplay } from './initMetricsDisplay.js';
import { initConnectionButtons } from './initConnectionButtons.js';
import { getInitState } from './getInitState.js';
import { handleWakeLock } from './ui/wakeLock.js';
import { registerServiceWorker } from './ui/serviceWorker.js';
import { initInstallPrompt } from './ui/installPrompt.js';
import { initSettings } from './ui/settings.js';
import { exposeVariablesDuringTest } from './exposeVariablesDuringTest.js';
import { StreamManager } from './streamManager.js';
import { initStreamViewer } from './ui/streamViewer.js';
import { initStreamingControls } from './initStreamingControls.js';

const { measurementsState, connectionsState, timeState } = getInitState();
exposeVariablesDuringTest({ measurementsState, connectionsState });

// Initialize stream manager
const streamManager = new StreamManager(measurementsState, timeState);

initTimerDisplay(timeState);
initMetricsDisplay({ connectionsState, measurementsState });

initConnectionButtons({ connectionsState, measurementsState });
initDiscardButton({ measurementsState, timeState });
initExportButton(measurementsState);
initMetricsToggle();

// Initialize streaming features
initStreamingControls(streamManager, timeState);
initStreamViewer();

handleWakeLock();
registerServiceWorker();
initInstallPrompt();
initSettings();
