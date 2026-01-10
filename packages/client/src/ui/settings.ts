/**
 * Settings Modal
 * 
 * Manages application settings stored in localStorage.
 * 
 * @module settings
 */

import { loadUserProfile, saveUserProfile } from './onboarding.js';
import { BluetoothDebugService } from '../services/debug/BluetoothDebugService.js';
import { getSettings, saveSettingsToStorage, defaultSettings, defaultAutoPauseSettings, defaultWorkoutMetadataSettings, defaultCountdownSettings, defaultAutoLapSettings, defaultEnhancedVoiceSettings, defaultVoiceMetrics, defaultIntervalsSettings } from '../config/settings.js';
import type { AppSettings, AutoPauseSource, AutoLapSource } from '../config/settings.js';
import { triggerInstallPrompt } from './installPrompt.js';
import { getAutoPauseSourceUnit } from '../services/AutoPauseService.js';
import { getSportSettings, saveSportSettings, formatPace } from '../config/sport.js';
import type { SportType } from '../config/sport.js';

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
    const settingShowCalories = document.getElementById('settingShowCalories') as HTMLInputElement | null;
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

    // Auto-Pause settings
    const settingAutoPauseEnabled = document.getElementById('settingAutoPauseEnabled') as HTMLInputElement | null;
    const settingAutoPauseSource = document.getElementById('settingAutoPauseSource') as HTMLSelectElement | null;
    const settingAutoPauseThreshold = document.getElementById('settingAutoPauseThreshold') as HTMLInputElement | null;
    const settingAutoPauseDelay = document.getElementById('settingAutoPauseDelay') as HTMLInputElement | null;
    const autoPauseOptions = document.getElementById('autoPauseOptions');
    const autoPauseThresholdUnit = document.getElementById('autoPauseThresholdUnit');

    // Export format settings
    const settingExportTcx = document.getElementById('settingExportTcx') as HTMLInputElement | null;
    const settingExportCsv = document.getElementById('settingExportCsv') as HTMLInputElement | null;
    const settingExportJson = document.getElementById('settingExportJson') as HTMLInputElement | null;
    const settingExportFit = document.getElementById('settingExportFit') as HTMLInputElement | null;

    // Workout metadata settings
    const settingPromptForNotes = document.getElementById('settingPromptForNotes') as HTMLInputElement | null;
    const settingPromptForExertion = document.getElementById('settingPromptForExertion') as HTMLInputElement | null;

    // Countdown settings
    const settingCountdownDuration = document.getElementById('settingCountdownDuration') as HTMLSelectElement | null;
    const settingCountdownBeep = document.getElementById('settingCountdownBeep') as HTMLInputElement | null;
    const settingCountdownVoice = document.getElementById('settingCountdownVoice') as HTMLInputElement | null;

    // Auto-Lap settings
    const settingAutoLapEnabled = document.getElementById('settingAutoLapEnabled') as HTMLInputElement | null;
    const settingAutoLapSource = document.getElementById('settingAutoLapSource') as HTMLSelectElement | null;
    const settingAutoLapDistance = document.getElementById('settingAutoLapDistance') as HTMLSelectElement | null;
    const settingAutoLapTime = document.getElementById('settingAutoLapTime') as HTMLSelectElement | null;
    const autoLapOptions = document.getElementById('autoLapOptions');
    const autoLapDistanceOption = document.getElementById('autoLapDistanceOption');
    const autoLapTimeOption = document.getElementById('autoLapTimeOption');

    // Enhanced Voice settings
    const settingVoiceTimeInterval = document.getElementById('settingVoiceTimeInterval') as HTMLSelectElement | null;
    const settingVoiceDistanceInterval = document.getElementById('settingVoiceDistanceInterval') as HTMLSelectElement | null;
    const settingVoiceSpeechRate = document.getElementById('settingVoiceSpeechRate') as HTMLSelectElement | null;
    const settingVoiceMetricPower = document.getElementById('settingVoiceMetricPower') as HTMLInputElement | null;
    const settingVoiceMetricHeartrate = document.getElementById('settingVoiceMetricHeartrate') as HTMLInputElement | null;
    const settingVoiceMetricCadence = document.getElementById('settingVoiceMetricCadence') as HTMLInputElement | null;
    const settingVoiceMetricSpeed = document.getElementById('settingVoiceMetricSpeed') as HTMLInputElement | null;
    const settingVoiceMetricDistance = document.getElementById('settingVoiceMetricDistance') as HTMLInputElement | null;
    const settingVoiceMetricTime = document.getElementById('settingVoiceMetricTime') as HTMLInputElement | null;

    // Sport Type settings
    const settingSportType = document.getElementById('settingSportType') as HTMLSelectElement | null;
    const settingShowPace = document.getElementById('settingShowPace') as HTMLInputElement | null;
    const settingThresholdPace = document.getElementById('settingThresholdPace') as HTMLInputElement | null;
    const runningOptions = document.getElementById('runningOptions');

    // Intervals.icu settings
    const settingIntervalsEnabled = document.getElementById('settingIntervalsEnabled') as HTMLInputElement | null;
    const settingIntervalsApiKey = document.getElementById('settingIntervalsApiKey') as HTMLInputElement | null;
    const toggleIntervalsApiKey = document.getElementById('toggleIntervalsApiKey') as HTMLButtonElement | null;
    const settingIntervalsAthleteId = document.getElementById('settingIntervalsAthleteId') as HTMLInputElement | null;
    const settingIntervalsAutoUpload = document.getElementById('settingIntervalsAutoUpload') as HTMLInputElement | null;
    const intervalsOptions = document.getElementById('intervalsOptions');

    // Debug settings
    const settingDebugMode = document.getElementById('settingDebugMode') as HTMLInputElement | null;
    const debugControls = document.getElementById('debugControls');
    const downloadDebugLogs = document.getElementById('downloadDebugLogs');
    const clearDebugLogs = document.getElementById('clearDebugLogs');

    // PWA Install button
    const installPwaButton = document.getElementById('installPwaButton');

    /**
     * Update Intervals UI visibility
     */
    const updateIntervalsUI = (): void => {
        if (intervalsOptions && settingIntervalsEnabled) {
            intervalsOptions.style.display = settingIntervalsEnabled.checked ? 'flex' : 'none';
        }
    };

    /**
     * Update sport type UI visibility (show running options when running/walking selected)
     */
    const updateSportUI = (): void => {
        if (runningOptions && settingSportType) {
            const isRunning = settingSportType.value === 'running' || settingSportType.value === 'walking';
            runningOptions.style.display = isRunning ? 'block' : 'none';
        }
    };

    /**
     * Parse pace string (MM:SS) to seconds per km
     */
    const parsePace = (paceStr: string): number | null => {
        const match = paceStr.match(/^(\d{1,2}):([0-5]\d)$/);
        if (!match) return null;
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        return minutes * 60 + seconds;
    };

    /**
     * Save sport settings
     */
    const saveSportSettingsFromUI = (): void => {
        const sportSettings = getSportSettings();

        if (settingSportType) {
            sportSettings.activeSport = settingSportType.value as SportType;
        }
        if (settingShowPace !== null) {
            sportSettings.running.showPace = settingShowPace.checked;
        }
        if (settingThresholdPace?.value) {
            const paceSeconds = parsePace(settingThresholdPace.value);
            if (paceSeconds !== null) {
                // Store threshold pace as target pace range (±30 sec)
                sportSettings.running.targetPaceMin = paceSeconds - 30;
                sportSettings.running.targetPaceMax = paceSeconds + 30;
            }
        }

        saveSportSettings(sportSettings);
    };

    /**
     * Load sport settings into UI
     */
    const loadSportSettings = (): void => {
        const sportSettings = getSportSettings();

        if (settingSportType) {
            settingSportType.value = sportSettings.activeSport;
        }
        if (settingShowPace) {
            settingShowPace.checked = sportSettings.running.showPace;
        }
        if (settingThresholdPace) {
            // Calculate threshold pace from target pace (middle of range)
            const thresholdPace = Math.round((sportSettings.running.targetPaceMin + sportSettings.running.targetPaceMax) / 2);
            settingThresholdPace.value = formatPace(thresholdPace);
        }

        updateSportUI();
    };

    // Sport type change listener
    settingSportType?.addEventListener('change', updateSportUI);

    /**
     * Toggle API Key visibility
     */
    toggleIntervalsApiKey?.addEventListener('click', () => {
        if (settingIntervalsApiKey) {
            const isPassword = settingIntervalsApiKey.type === 'password';
            settingIntervalsApiKey.type = isPassword ? 'text' : 'password';
            if (toggleIntervalsApiKey) {
                toggleIntervalsApiKey.textContent = isPassword ? '🙈' : '👁️';
            }
        }
    });

    settingIntervalsEnabled?.addEventListener('change', updateIntervalsUI);

    /**
     * Update auto-pause options visibility and unit label
     */
    const updateAutoPauseUI = (): void => {
        if (autoPauseOptions && settingAutoPauseEnabled) {
            autoPauseOptions.style.opacity = settingAutoPauseEnabled.checked ? '1' : '0.5';
            autoPauseOptions.style.pointerEvents = settingAutoPauseEnabled.checked ? 'auto' : 'none';
        }
        if (autoPauseThresholdUnit && settingAutoPauseSource) {
            const unit = getAutoPauseSourceUnit(settingAutoPauseSource.value as AutoPauseSource);
            autoPauseThresholdUnit.textContent = unit;
        }
    };

    // Add event listeners for auto-pause UI updates
    settingAutoPauseEnabled?.addEventListener('change', updateAutoPauseUI);
    settingAutoPauseSource?.addEventListener('change', updateAutoPauseUI);

    /**
     * Update auto-lap options visibility and source options
     */
    const updateAutoLapUI = (): void => {
        if (autoLapOptions && settingAutoLapEnabled) {
            autoLapOptions.style.opacity = settingAutoLapEnabled.checked ? '1' : '0.5';
            autoLapOptions.style.pointerEvents = settingAutoLapEnabled.checked ? 'auto' : 'none';
        }
        if (autoLapDistanceOption && autoLapTimeOption && settingAutoLapSource) {
            const isDistance = settingAutoLapSource.value === 'distance';
            autoLapDistanceOption.style.display = isDistance ? 'flex' : 'none';
            autoLapTimeOption.style.display = isDistance ? 'none' : 'flex';
        }
    };

    // Add event listeners for auto-lap UI updates
    settingAutoLapEnabled?.addEventListener('change', updateAutoLapUI);
    settingAutoLapSource?.addEventListener('change', updateAutoLapUI);

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
        toggleMetric('energy', settings.showCalories);
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
            weightKg: settingWeight?.value ? Number(settingWeight.value) : defaultSettings.weightKg,
            showCalories: settingShowCalories?.checked ?? defaultSettings.showCalories,
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
            autoPause: {
                enabled: settingAutoPauseEnabled?.checked ?? defaultAutoPauseSettings.enabled,
                source: (settingAutoPauseSource?.value as AutoPauseSource) ?? defaultAutoPauseSettings.source,
                threshold: settingAutoPauseThreshold?.value ? Number(settingAutoPauseThreshold.value) : defaultAutoPauseSettings.threshold,
                delay: settingAutoPauseDelay?.value ? Number(settingAutoPauseDelay.value) : defaultAutoPauseSettings.delay,
            },
            workoutMetadata: {
                promptForNotes: settingPromptForNotes?.checked ?? defaultWorkoutMetadataSettings.promptForNotes,
                promptForExertion: settingPromptForExertion?.checked ?? defaultWorkoutMetadataSettings.promptForExertion,
            },
            countdown: {
                duration: (settingCountdownDuration?.value ? parseInt(settingCountdownDuration.value) : defaultCountdownSettings.duration) as 0 | 3 | 5 | 10,
                enableBeep: settingCountdownBeep?.checked ?? defaultCountdownSettings.enableBeep,
                enableVoice: settingCountdownVoice?.checked ?? defaultCountdownSettings.enableVoice,
            },
            autoLap: {
                enabled: settingAutoLapEnabled?.checked ?? defaultAutoLapSettings.enabled,
                source: (settingAutoLapSource?.value as AutoLapSource) ?? defaultAutoLapSettings.source,
                distanceKm: settingAutoLapDistance?.value ? Number(settingAutoLapDistance.value) : defaultAutoLapSettings.distanceKm,
                timeMinutes: settingAutoLapTime?.value ? Number(settingAutoLapTime.value) : defaultAutoLapSettings.timeMinutes,
            },
            enhancedVoice: {
                timeIntervalMinutes: (settingVoiceTimeInterval?.value ? parseInt(settingVoiceTimeInterval.value) : defaultEnhancedVoiceSettings.timeIntervalMinutes) as 0 | 1 | 5 | 10 | 15 | 30,
                distanceIntervalKm: (settingVoiceDistanceInterval?.value ? parseInt(settingVoiceDistanceInterval.value) : defaultEnhancedVoiceSettings.distanceIntervalKm) as 0 | 1 | 5 | 10,
                metrics: {
                    power: settingVoiceMetricPower?.checked ?? defaultVoiceMetrics.power,
                    heartrate: settingVoiceMetricHeartrate?.checked ?? defaultVoiceMetrics.heartrate,
                    cadence: settingVoiceMetricCadence?.checked ?? defaultVoiceMetrics.cadence,
                    speed: settingVoiceMetricSpeed?.checked ?? defaultVoiceMetrics.speed,
                    distance: settingVoiceMetricDistance?.checked ?? defaultVoiceMetrics.distance,
                    time: settingVoiceMetricTime?.checked ?? defaultVoiceMetrics.time,
                },
                speechRate: (settingVoiceSpeechRate?.value ? parseFloat(settingVoiceSpeechRate.value) : defaultEnhancedVoiceSettings.speechRate) as 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2,
            },
            intervals: {
                enabled: settingIntervalsEnabled?.checked ?? defaultIntervalsSettings.enabled,
                apiKey: settingIntervalsApiKey?.value ?? defaultIntervalsSettings.apiKey,
                athleteId: settingIntervalsAthleteId?.value ?? defaultIntervalsSettings.athleteId,
                autoUpload: settingIntervalsAutoUpload?.checked ?? defaultIntervalsSettings.autoUpload,
            },
            exportTcx: settingExportTcx?.checked ?? defaultSettings.exportTcx,
            exportCsv: settingExportCsv?.checked ?? defaultSettings.exportCsv,
            exportJson: settingExportJson?.checked ?? defaultSettings.exportJson,
            exportFit: settingExportFit?.checked ?? defaultSettings.exportFit,
            debugMode: settingDebugMode?.checked ?? defaultSettings.debugMode,
        };

        // saveSettingsToStorage dispatches 'settings-changed' internally
        saveSettingsToStorage(settings);

        // Save sport settings separately
        saveSportSettingsFromUI();

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
        if (settingShowCalories) settingShowCalories.checked = settings.showCalories;
        if (settingTreadmillSpeed) settingTreadmillSpeed.checked = settings.treadmillSpeed;
        if (settingPower3s) settingPower3s.checked = settings.power3s;

        // Accessibility settings
        if (settingHighContrast) settingHighContrast.checked = settings.highContrast;
        if (settingColorblindPatterns) settingColorblindPatterns.checked = settings.colorblindPatterns;

        // Voice Feedback settings
        if (settingVoiceEnabled) settingVoiceEnabled.checked = settings.voiceEnabled;
        if (settingVoiceLaps) settingVoiceLaps.checked = settings.voiceLaps;
        if (settingVoiceZones) settingVoiceZones.checked = settings.voiceZones;

        // Auto-Pause settings
        if (settingAutoPauseEnabled) settingAutoPauseEnabled.checked = settings.autoPause.enabled;
        if (settingAutoPauseSource) settingAutoPauseSource.value = settings.autoPause.source;
        if (settingAutoPauseThreshold) settingAutoPauseThreshold.value = settings.autoPause.threshold.toString();
        if (settingAutoPauseDelay) settingAutoPauseDelay.value = settings.autoPause.delay.toString();
        updateAutoPauseUI();

        // Export format settings
        if (settingExportTcx) settingExportTcx.checked = settings.exportTcx;
        if (settingExportCsv) settingExportCsv.checked = settings.exportCsv;
        if (settingExportJson) settingExportJson.checked = settings.exportJson;
        if (settingExportFit) settingExportFit.checked = settings.exportFit;

        // Workout metadata settings
        if (settingPromptForNotes) settingPromptForNotes.checked = settings.workoutMetadata.promptForNotes;
        if (settingPromptForExertion) settingPromptForExertion.checked = settings.workoutMetadata.promptForExertion;

        // Countdown settings
        if (settingCountdownDuration) settingCountdownDuration.value = settings.countdown.duration.toString();
        if (settingCountdownBeep) settingCountdownBeep.checked = settings.countdown.enableBeep;
        if (settingCountdownVoice) settingCountdownVoice.checked = settings.countdown.enableVoice;

        // Auto-Lap settings
        if (settingAutoLapEnabled) settingAutoLapEnabled.checked = settings.autoLap.enabled;
        if (settingAutoLapSource) settingAutoLapSource.value = settings.autoLap.source;
        if (settingAutoLapDistance) settingAutoLapDistance.value = settings.autoLap.distanceKm.toString();
        if (settingAutoLapTime) settingAutoLapTime.value = settings.autoLap.timeMinutes.toString();
        updateAutoLapUI();

        // Enhanced Voice settings
        if (settingVoiceTimeInterval) settingVoiceTimeInterval.value = settings.enhancedVoice.timeIntervalMinutes.toString();
        if (settingVoiceDistanceInterval) settingVoiceDistanceInterval.value = settings.enhancedVoice.distanceIntervalKm.toString();
        if (settingVoiceSpeechRate) settingVoiceSpeechRate.value = settings.enhancedVoice.speechRate.toString();
        if (settingVoiceMetricPower) settingVoiceMetricPower.checked = settings.enhancedVoice.metrics.power;
        if (settingVoiceMetricHeartrate) settingVoiceMetricHeartrate.checked = settings.enhancedVoice.metrics.heartrate;
        if (settingVoiceMetricCadence) settingVoiceMetricCadence.checked = settings.enhancedVoice.metrics.cadence;
        if (settingVoiceMetricSpeed) settingVoiceMetricSpeed.checked = settings.enhancedVoice.metrics.speed;
        if (settingVoiceMetricDistance) settingVoiceMetricDistance.checked = settings.enhancedVoice.metrics.distance;
        if (settingVoiceMetricTime) settingVoiceMetricTime.checked = settings.enhancedVoice.metrics.time;

        // Intervals.icu settings
        if (settingIntervalsEnabled) settingIntervalsEnabled.checked = settings.intervals.enabled;
        if (settingIntervalsApiKey) settingIntervalsApiKey.value = settings.intervals.apiKey;
        if (settingIntervalsAthleteId) settingIntervalsAthleteId.value = settings.intervals.athleteId;
        if (settingIntervalsAutoUpload) settingIntervalsAutoUpload.checked = settings.intervals.autoUpload;
        updateIntervalsUI();

        // Debug settings
        if (settingDebugMode) settingDebugMode.checked = settings.debugMode;

        // Sport settings (stored separately)
        loadSportSettings();

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

    // PWA Install button handler
    installPwaButton?.addEventListener('click', async () => {
        const outcome = await triggerInstallPrompt();

        if (outcome === 'accepted') {
            // App will be installed, button will hide automatically via installPrompt.ts
            console.log('PWA installation accepted');
        } else if (outcome === 'dismissed') {
            console.log('PWA installation dismissed');
        } else {
            alert('Installation is not available at this time. The app may already be installed or your browser does not support installation.');
        }
    });

    // Initialize
    loadSettings();
}
