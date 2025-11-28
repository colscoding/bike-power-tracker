
export function initSettings() {
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const saveSettingsButton = document.getElementById('saveSettings');

    const settingPower = document.getElementById('settingPower');
    const settingCadence = document.getElementById('settingCadence');
    const settingHeartrate = document.getElementById('settingHeartrate');

    // Load settings from localStorage
    const loadSettings = () => {
        const settings = JSON.parse(localStorage.getItem('bpt-settings')) || {
            power: true,
            cadence: true,
            heartrate: true
        };

        settingPower.checked = settings.power;
        settingCadence.checked = settings.cadence;
        settingHeartrate.checked = settings.heartrate;

        applySettings(settings);
    };

    // Save settings to localStorage
    const saveSettings = () => {
        const settings = {
            power: settingPower.checked,
            cadence: settingCadence.checked,
            heartrate: settingHeartrate.checked
        };

        localStorage.setItem('bpt-settings', JSON.stringify(settings));
        applySettings(settings);
        closeModal();
    };

    // Apply settings to the UI
    const applySettings = (settings) => {
        const toggleMetric = (metric, isVisible) => {
            const elements = document.querySelectorAll(`.metric-group-${metric}`);
            elements.forEach(el => {
                el.style.display = isVisible ? 'flex' : 'none';
            });
        };

        toggleMetric('power', settings.power);
        toggleMetric('cadence', settings.cadence);
        toggleMetric('heartrate', settings.heartrate);
    };

    const openModal = () => {
        settingsModal.style.display = 'flex';
        // Close the main menu details element
        const details = document.querySelector('header details');
        if (details) {
            details.removeAttribute('open');
        }
    };

    const closeModal = () => {
        settingsModal.style.display = 'none';
    };

    // Event Listeners
    settingsButton.addEventListener('click', openModal);
    closeSettingsModal.addEventListener('click', closeModal);
    saveSettingsButton.addEventListener('click', saveSettings);

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            closeModal();
        }
    });

    // Initialize
    loadSettings();
}
