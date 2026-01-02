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
    // Dashboard display settings
    power: boolean;
    cadence: boolean;
    heartrate: boolean;
    power3s: boolean;

    // Accessibility settings
    highContrast: boolean;
    colorblindPatterns: boolean;

    // Voice Feedback settings
    voiceEnabled: boolean;
    voiceLaps: boolean;
    voiceZones: boolean;

    // Export format settings
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
    power3s: false,
    highContrast: false,
    colorblindPatterns: false,
    voiceEnabled: false,
    voiceLaps: true,
    voiceZones: true,
    exportTcx: true,
    exportCsv: true,
    exportJson: false,
    exportFit: false,
};

/**
 * Get current settings from localStorage
 */
export function getSettings(): AppSettings {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    return settingsJson
        ? { ...defaultSettings, ...JSON.parse(settingsJson) }
        : { ...defaultSettings };
}

/**
 * Initialize the settings modal and controls.
 * 
 * Sets up:
 * - Settings button to open modal
 * - Settings checkboxes for metrics visibility
 * - Settings checkboxes for accessibility options
 * - Settings checkboxes for export formats
 * - Save and close functionality
 */
export function initSettings(): void {
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const saveSettingsButton = document.getElementById('saveSettings');

    // Dashboard display settings
    const settingPower = document.getElementById('settingPower') as HTMLInputElement | null;
    const settingCadence = document.getElementById('settingCadence') as HTMLInputElement | null;
    const settingHeartrate = document.getElementById('settingHeartrate') as HTMLInputElement | null;
    const settingPower3s = document.getElementById('settingPower3s') as HTMLInputElement | null;

    // Accessibility settings
    const settingHighContrast = document.getElementById('settingHighContrast') as HTMLInputElement | null;
    const settingColorblindPatterns = document.getElementById('settingColorblindPatterns') as HTMLInputElement | null;

    // Voice Feedback settings
    const settingVoiceEnabled = document.getElementById('settingVoiceEnabled') as HTMLInputElement | null;
    const settingVoiceLaps = document.getElementById('settingVoiceLaps') as HTMLInputElement | null;
    const settingVoiceZones = document.getElementById('settingVoiceZones') as HTMLInputElement | null;

    // Export format settings
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
        const settings = getSettings();

        // Dashboard display settings
        if (settingPower) settingPower.checked = settings.power;
        if (settingCadence) settingCadence.checked = settings.cadence;
        if (settingHeartrate) settingHeartrate.checked = settings.heartrate;
        if (settingPower3s) settingPower3s.checked = settings.power3s;

        // Accessibility settings
        if (settingHighContrast) settingHighContrast.checked = settings.highContrast;
        if (settingColorblindPatterns) settingColorblindPatterns.checked = settings.colorblindPatterns;

        // Voice Feedback settings
        if (settingVoiceEnabled) settingVoiceEnabled.checked = settings.voiceEnabled;
        if (settingVoiceLaps) settingVoiceLaps.checked = settings.voiceLaps;
        if (settingVoiceZones) settingVoiceZones.checked = settings.voiceZones;

        // Export format settings
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
            power3s: settingPower3s?.checked ?? defaultSettings.power3s,
            highContrast: settingHighContrast?.checked ?? defaultSettings.highContrast,
            colorblindPatterns: settingColorblindPatterns?.checked ?? defaultSettings.colorblindPatterns,
            voiceEnabled: settingVoiceEnabled?.checked ?? defaultSettings.voiceEnabled,
            voiceLaps: settingVoiceLaps?.checked ?? defaultSettings.voiceLaps,
            voiceZones: settingVoiceZones?.checked ?? defaultSettings.voiceZones,
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
        // Toggle metric visibility
        const toggleMetric = (metric: string, isVisible: boolean): void => {
            const elements = document.querySelectorAll(`.metric-group-${metric}`);
            elements.forEach((el) => {
                (el as HTMLElement).style.display = isVisible ? 'flex' : 'none';
            });
        };

        toggleMetric('power', settings.power);
        toggleMetric('cadence', settings.cadence);
        toggleMetric('heartrate', settings.heartrate);

        // Apply 3-second average power indicator
        const powerMetrics = document.querySelectorAll('.metric-group-power');
        powerMetrics.forEach((el) => {
            if (settings.power3s) {
                el.setAttribute('data-show-avg', 'true');
            } else {
                el.removeAttribute('data-show-avg');
            }
        });

        // Apply high contrast mode
        if (settings.highContrast) {
            document.documentElement.setAttribute('data-high-contrast', 'true');
        } else {
            document.documentElement.removeAttribute('data-high-contrast');
        }

        // Apply colorblind patterns (enabled when high contrast + colorblind patterns both on)
        if (settings.colorblindPatterns) {
            document.documentElement.setAttribute('data-colorblind-patterns', 'true');
        } else {
            document.documentElement.removeAttribute('data-colorblind-patterns');
        }
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
