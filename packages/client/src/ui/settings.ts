/**
 * Settings Modal
 * 
 * Manages application settings stored in localStorage.
 * 
 * @module settings
 */

import { loadUserProfile, saveUserProfile } from './onboarding.js';
import { BluetoothDebugService } from '../services/debug/BluetoothDebugService.js';
import { getSettings, saveSettingsToStorage, defaultSettings } from '../config/settings.js';
import type { AppSettings } from '../config/settings.js';

// Re-export for compatibility if needed (but prefer importing from config)
export { getSettings };


/**
 * Initialize the Settings UI logic
 */
export function initSettingsLogic(): void {
    const saveSettingsButton = document.getElementById('saveSettings');

    // User Profile settings
    const settingFtp = document.getElementById('settingFtp') as HTMLInputElement | null;
    const settingMaxHr = document.getElementById('settingMaxHr') as HTMLInputElement | null;
    const settingWeight = document.getElementById('settingWeight') as HTMLInputElement | null;

    // Dashboard display settings
    const settingSpeed = document.getElementById('settingSpeed') as HTMLInputElement | null;
    const settingDistance = document.getElementById('settingDistance') as HTMLInputElement | null;
    const settingAltitude = document.getElementById('settingAltitude') as HTMLInputElement | null;
    const settingPower = document.getElementById('settingPower') as HTMLInputElement | null;
    const settingCadence = document.getElementById('settingCadence') as HTMLInputElement | null;
    const settingHeartrate = document.getElementById('settingHeartrate') as HTMLInputElement | null;
    const settingTreadmillSpeed = document.getElementById('settingTreadmillSpeed') as HTMLInputElement | null;
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

    // Debug settings
    const settingDebugMode = document.getElementById('settingDebugMode') as HTMLInputElement | null;
    const debugControls = document.getElementById('debugControls');
    const downloadDebugLogs = document.getElementById('downloadDebugLogs');
    const clearDebugLogs = document.getElementById('clearDebugLogs');


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

        toggleMetric('speed', settings.speed);
        toggleMetric('distance', settings.distance);
        toggleMetric('altitude', settings.altitude);
        toggleMetric('power', settings.power);
        toggleMetric('cadence', settings.cadence);
        toggleMetric('heartrate', settings.heartrate);
        toggleMetric('treadmillSpeed', settings.treadmillSpeed);

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

        // Apply debug mode UI
        if (debugControls) {
            debugControls.style.display = settings.debugMode ? 'flex' : 'none';
        }
    };

    /**
     * Save settings to localStorage
     */
    const saveSettings = (): void => {
        // Save User Profile
        const currentProfile = loadUserProfile();
        const updatedProfile = {
            ...currentProfile,
            ftp: settingFtp?.value ? Number(settingFtp.value) : null,
            maxHr: settingMaxHr?.value ? Number(settingMaxHr.value) : null,
            weight: settingWeight?.value ? Number(settingWeight.value) : null,
        };
        saveUserProfile(updatedProfile);
        window.dispatchEvent(new CustomEvent('user-profile-changed'));

        const settings: AppSettings = {
            speed: settingSpeed?.checked ?? defaultSettings.speed,
            distance: settingDistance?.checked ?? defaultSettings.distance,
            altitude: settingAltitude?.checked ?? defaultSettings.altitude,
            power: settingPower?.checked ?? defaultSettings.power,
            cadence: settingCadence?.checked ?? defaultSettings.cadence,
            heartrate: settingHeartrate?.checked ?? defaultSettings.heartrate,
            treadmillSpeed: settingTreadmillSpeed?.checked ?? defaultSettings.treadmillSpeed,
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
            debugMode: settingDebugMode?.checked ?? defaultSettings.debugMode,
        };

        // saveSettingsToStorage dispatches 'settings-changed' internally
        saveSettingsToStorage(settings);
        applySettings(settings);
    };

    /**
     * Load settings from localStorage
     */
    const loadSettings = (): void => {
        const settings = getSettings();
        const profile = loadUserProfile();

        // User Profile settings
        if (settingFtp) settingFtp.value = profile.ftp?.toString() ?? '';
        if (settingMaxHr) settingMaxHr.value = profile.maxHr?.toString() ?? '';
        if (settingWeight) settingWeight.value = profile.weight?.toString() ?? '';

        // Dashboard display settings
        if (settingPower) settingPower.checked = settings.power;
        if (settingCadence) settingCadence.checked = settings.cadence;
        if (settingHeartrate) settingHeartrate.checked = settings.heartrate;
        if (settingSpeed) settingSpeed.checked = settings.speed;
        if (settingDistance) settingDistance.checked = settings.distance;
        if (settingAltitude) settingAltitude.checked = settings.altitude;
        if (settingTreadmillSpeed) settingTreadmillSpeed.checked = settings.treadmillSpeed;
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

        // Debug settings
        if (settingDebugMode) settingDebugMode.checked = settings.debugMode;

        applySettings(settings);
    };

    // Event Listeners
    saveSettingsButton?.addEventListener('click', saveSettings);

    downloadDebugLogs?.addEventListener('click', () => {
        BluetoothDebugService.exportLogs();
    });

    clearDebugLogs?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all debug logs?')) {
            await BluetoothDebugService.clearLogs();
            alert('Logs cleared.');
        }
    });

    // Initialize
    loadSettings();
}
