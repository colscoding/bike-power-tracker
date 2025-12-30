/**
 * Settings Modal
 * 
 * Manages application settings stored in localStorage.
 * 
 * @module settings
 */

/**
 * Application settings
 */
export interface AppSettings {
    power: boolean;
    cadence: boolean;
    heartrate: boolean;
    exportTcx: boolean;
    exportCsv: boolean;
    exportJson: boolean;
    exportFit: boolean;
}

/** Storage key for settings */
const SETTINGS_KEY = 'bpt-settings';

/** Default settings */
const defaultSettings: AppSettings = {
    power: true,
    cadence: true,
    heartrate: true,
    exportTcx: true,
    exportCsv: true,
    exportJson: false,
    exportFit: false,
};

/**
 * Initialize the settings modal and controls.
 * 
 * Sets up:
 * - Settings button to open modal
 * - Settings checkboxes for metrics visibility
 * - Settings checkboxes for export formats
 * - Save and close functionality
 */
export function initSettings(): void {
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const saveSettingsButton = document.getElementById('saveSettings');

    const settingPower = document.getElementById('settingPower') as HTMLInputElement | null;
    const settingCadence = document.getElementById('settingCadence') as HTMLInputElement | null;
    const settingHeartrate = document.getElementById('settingHeartrate') as HTMLInputElement | null;
    const settingExportTcx = document.getElementById('settingExportTcx') as HTMLInputElement | null;
    const settingExportCsv = document.getElementById('settingExportCsv') as HTMLInputElement | null;
    const settingExportJson = document.getElementById('settingExportJson') as HTMLInputElement | null;
    const settingExportFit = document.getElementById('settingExportFit') as HTMLInputElement | null;

    if (!settingsButton || !settingsModal) {
        console.warn('Settings elements not found in DOM');
        return;
    }

    /**
     * Load settings from localStorage
     */
    const loadSettings = (): void => {
        const settingsJson = localStorage.getItem(SETTINGS_KEY);
        const settings: AppSettings = settingsJson
            ? { ...defaultSettings, ...JSON.parse(settingsJson) }
            : defaultSettings;

        if (settingPower) settingPower.checked = settings.power;
        if (settingCadence) settingCadence.checked = settings.cadence;
        if (settingHeartrate) settingHeartrate.checked = settings.heartrate;
        if (settingExportTcx) settingExportTcx.checked = settings.exportTcx;
        if (settingExportCsv) settingExportCsv.checked = settings.exportCsv;
        if (settingExportJson) settingExportJson.checked = settings.exportJson;
        if (settingExportFit) settingExportFit.checked = settings.exportFit;

        applySettings(settings);
    };

    /**
     * Save settings to localStorage
     */
    const saveSettings = (): void => {
        const settings: AppSettings = {
            power: settingPower?.checked ?? defaultSettings.power,
            cadence: settingCadence?.checked ?? defaultSettings.cadence,
            heartrate: settingHeartrate?.checked ?? defaultSettings.heartrate,
            exportTcx: settingExportTcx?.checked ?? defaultSettings.exportTcx,
            exportCsv: settingExportCsv?.checked ?? defaultSettings.exportCsv,
            exportJson: settingExportJson?.checked ?? defaultSettings.exportJson,
            exportFit: settingExportFit?.checked ?? defaultSettings.exportFit,
        };

        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        applySettings(settings);
        closeModal();
    };

    /**
     * Apply settings to the UI
     */
    const applySettings = (settings: AppSettings): void => {
        const toggleMetric = (metric: string, isVisible: boolean): void => {
            const elements = document.querySelectorAll(`.metric-group-${metric}`);
            elements.forEach((el) => {
                (el as HTMLElement).style.display = isVisible ? 'flex' : 'none';
            });
        };

        toggleMetric('power', settings.power);
        toggleMetric('cadence', settings.cadence);
        toggleMetric('heartrate', settings.heartrate);
    };

    /**
     * Open the settings modal
     */
    const openModal = (): void => {
        settingsModal.style.display = 'flex';
        // Close the main menu details element
        const details = document.querySelector('header details');
        if (details) {
            details.removeAttribute('open');
        }
    };

    /**
     * Close the settings modal
     */
    const closeModal = (): void => {
        settingsModal.style.display = 'none';
    };

    // Event Listeners
    settingsButton.addEventListener('click', openModal);
    closeSettingsModal?.addEventListener('click', closeModal);
    saveSettingsButton?.addEventListener('click', saveSettings);

    // Close modal when clicking outside
    window.addEventListener('click', (event: MouseEvent) => {
        if (event.target === settingsModal) {
            closeModal();
        }
    });

    // Initialize
    loadSettings();
}
