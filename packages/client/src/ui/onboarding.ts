/**
 * Onboarding Flow
 *
 * First-run setup wizard for new users.
 * Guides users through:
 * - FTP (Functional Threshold Power) entry
 * - Max Heart Rate entry
 * - Weight entry
 * - Sensor pairing guide
 * - Feature tour
 *
 * @module onboarding
 */

import { announce, trapFocus } from './accessibility.js';
import { showNotification } from './notifications.js';
import { selectElement } from '../utils/dom.js';

import { type UserProfile, loadUserProfile, saveUserProfile } from '../storage/userSettings.js';

export { loadUserProfile, saveUserProfile };
export type { UserProfile };


/**
 * Onboarding step configuration
 */
interface OnboardingStep {
    id: string;
    title: string;
    icon: string;
    content: string;
    inputType?: 'number' | 'none';
    inputLabel?: string;
    inputPlaceholder?: string;
    inputUnit?: string;
    inputMin?: number;
    inputMax?: number;
    profileKey?: keyof UserProfile;
    helpText?: string;
}

/**
 * Onboarding steps configuration
 */
const onboardingSteps: OnboardingStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Bike Power Tracker!',
        icon: '🚴',
        content: `
            <p>Let's set up your profile for personalized training zones and better workout analysis.</p>
            <p>This will only take a minute, and you can update these settings anytime.</p>
        `,
    },
    {
        id: 'ftp',
        title: 'Functional Threshold Power (FTP)',
        icon: '⚡',
        content: `
            <p>Your FTP is the highest power you can sustain for about an hour.</p>
            <p>If you don't know your FTP, you can skip this and do an FTP test later.</p>
        `,
        inputType: 'number',
        inputLabel: 'Your FTP',
        inputPlaceholder: 'e.g., 200',
        inputUnit: 'watts',
        inputMin: 50,
        inputMax: 500,
        profileKey: 'ftp',
        helpText: 'Typical range: 100-400W for recreational to elite cyclists',
    },
    {
        id: 'maxhr',
        title: 'Maximum Heart Rate',
        icon: '❤️',
        content: `
            <p>Your max HR is used to calculate heart rate training zones.</p>
            <p>A common estimate is 220 minus your age, but actual max HR varies.</p>
        `,
        inputType: 'number',
        inputLabel: 'Your Max HR',
        inputPlaceholder: 'e.g., 185',
        inputUnit: 'bpm',
        inputMin: 100,
        inputMax: 230,
        profileKey: 'maxHr',
        helpText: 'If unsure, use 220 - your age as a starting point',
    },
    {
        id: 'weight',
        title: 'Body Weight',
        icon: '⚖️',
        content: `
            <p>Your weight is used to calculate power-to-weight ratio (W/kg), an important metric for climbing.</p>
        `,
        inputType: 'number',
        inputLabel: 'Your Weight',
        inputPlaceholder: 'e.g., 70',
        inputUnit: 'kg',
        inputMin: 30,
        inputMax: 200,
        profileKey: 'weight',
        helpText: 'Used for calculating watts per kilogram (W/kg)',
    },
    {
        id: 'sensors',
        title: 'Connect Your Sensors',
        icon: '📡',
        content: `
            <p>Bike Power Tracker works with Bluetooth cycling sensors:</p>
            <ul style="text-align: left; margin: 16px auto; max-width: 280px;">
                <li><strong>⚡ Power Meter</strong> - Measures your power output in watts</li>
                <li><strong>🚴 Cadence Sensor</strong> - Tracks your pedaling speed (RPM)</li>
                <li><strong>❤️ Heart Rate Monitor</strong> - Monitors your heart rate</li>
            </ul>
            <p>Use the menu (☰) to connect your sensors before starting a workout.</p>
        `,
    },
    {
        id: 'shortcuts',
        title: 'Keyboard Shortcuts',
        icon: '⌨️',
        content: `
            <p>Quick access to common actions:</p>
            <table style="margin: 16px auto; text-align: left; border-collapse: collapse;">
                <tr><td style="padding: 4px 12px;"><kbd>Space</kbd></td><td>Start/pause workout</td></tr>
                <tr><td style="padding: 4px 12px;"><kbd>L</kbd></td><td>Mark lap</td></tr>
                <tr><td style="padding: 4px 12px;"><kbd>M</kbd></td><td>Open menu</td></tr>
                <tr><td style="padding: 4px 12px;"><kbd>S</kbd></td><td>Open settings</td></tr>
                <tr><td style="padding: 4px 12px;"><kbd>E</kbd></td><td>Export data</td></tr>
                <tr><td style="padding: 4px 12px;"><kbd>Escape</kbd></td><td>Close modal</td></tr>
            </table>
        `,
    },
    {
        id: 'done',
        title: 'You\'re All Set!',
        icon: '🎉',
        content: `
            <p>Your profile has been saved. You can update your settings anytime from the menu.</p>
            <p>Ready to start your first workout? Connect a sensor and press the <strong>▶️ Start</strong> button!</p>
        `,
    },
];

/**
 * Create the onboarding modal element
 */
function createOnboardingModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'onboardingModal';
    modal.className = 'stream-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'onboardingTitle');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="stream-modal-content onboarding-modal" style="max-width: 480px;">
            <div class="stream-modal-header">
                <h2 id="onboardingTitle">
                    <span id="onboardingIcon">🚴</span>
                    <span id="onboardingStepTitle">Welcome</span>
                </h2>
                <button id="skipOnboarding" class="close-button" aria-label="Skip onboarding">&times;</button>
            </div>
            <div class="stream-modal-body" style="text-align: center; padding: 24px;">
                <div id="onboardingContent"></div>
                <div id="onboardingInput" style="margin: 20px 0; display: none;">
                    <label for="onboardingInputField" id="onboardingInputLabel" style="display: block; margin-bottom: 8px; font-weight: bold;"></label>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <input type="number" id="onboardingInputField" 
                            style="width: 120px; padding: 12px; font-size: 18px; text-align: center; border: 2px solid #d0d7de; border-radius: 8px;"
                            aria-describedby="onboardingHelpText">
                        <span id="onboardingInputUnit" style="font-size: 16px; color: #666;"></span>
                    </div>
                    <p id="onboardingHelpText" style="margin-top: 8px; font-size: 12px; color: #666;"></p>
                </div>
                <div class="onboarding-progress" style="margin: 24px 0;">
                    <div id="onboardingProgressDots" style="display: flex; justify-content: center; gap: 8px;"></div>
                </div>
                <div class="onboarding-buttons" style="display: flex; justify-content: center; gap: 12px; margin-top: 20px;">
                    <button id="onboardingPrev" style="padding: 12px 24px; border: 1px solid #d0d7de; background: white; border-radius: 8px; cursor: pointer; font-size: 16px;">
                        ← Back
                    </button>
                    <button id="onboardingNext" style="padding: 12px 24px; border: none; background: #2196F3; color: white; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
                        Next →
                    </button>
                </div>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Render progress dots
 */
function renderProgressDots(container: HTMLElement, currentStep: number, totalSteps: number): void {
    container.innerHTML = '';
    for (let i = 0; i < totalSteps; i++) {
        const dot = document.createElement('span');
        dot.style.cssText = `
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: ${i === currentStep ? '#2196F3' : '#d0d7de'};
            transition: background 0.3s ease;
        `;
        dot.setAttribute('aria-hidden', 'true');
        container.appendChild(dot);
    }
}

/**
 * Render a step in the onboarding flow
 */
function renderStep(
    step: OnboardingStep,
    stepIndex: number,
    profile: UserProfile,
    elements: {
        icon: HTMLElement;
        title: HTMLElement;
        content: HTMLElement;
        inputContainer: HTMLElement;
        inputField: HTMLInputElement;
        inputLabel: HTMLElement;
        inputUnit: HTMLElement;
        helpText: HTMLElement;
        prevBtn: HTMLButtonElement;
        nextBtn: HTMLButtonElement;
        progressDots: HTMLElement;
    }
): void {
    const { icon, title, content, inputContainer, inputField, inputLabel, inputUnit, helpText, prevBtn, nextBtn, progressDots } = elements;

    // Update header
    icon.textContent = step.icon;
    title.textContent = step.title;

    // Update content
    content.innerHTML = step.content;

    // Handle input
    if (step.inputType === 'number' && step.profileKey) {
        inputContainer.style.display = 'block';
        inputLabel.textContent = step.inputLabel || '';
        inputField.placeholder = step.inputPlaceholder || '';
        inputField.min = String(step.inputMin || 0);
        inputField.max = String(step.inputMax || 9999);
        inputUnit.textContent = step.inputUnit || '';
        helpText.textContent = step.helpText || '';

        // Load existing value
        const currentValue = profile[step.profileKey];
        inputField.value = currentValue ? String(currentValue) : '';
        inputField.focus();
    } else {
        inputContainer.style.display = 'none';
    }

    // Update buttons
    prevBtn.style.display = stepIndex === 0 ? 'none' : 'inline-block';

    if (stepIndex === onboardingSteps.length - 1) {
        nextBtn.textContent = 'Get Started! 🚀';
    } else if (step.inputType === 'number') {
        nextBtn.textContent = 'Next →';
    } else {
        nextBtn.textContent = 'Next →';
    }

    // Update progress dots
    renderProgressDots(progressDots, stepIndex, onboardingSteps.length);

    // Announce for screen readers
    announce(`Step ${stepIndex + 1} of ${onboardingSteps.length}: ${step.title}`);
}

/**
 * Show the onboarding flow
 */
export function showOnboarding(forceShow = false): Promise<UserProfile> {
    return new Promise((resolve) => {
        const profile = loadUserProfile();

        // Check if onboarding should be shown
        if (!forceShow && profile.onboardingComplete) {
            resolve(profile);
            return;
        }

        // Create modal if it doesn't exist
        let modal = document.getElementById('onboardingModal');
        if (!modal) {
            modal = createOnboardingModal();
            document.body.appendChild(modal);
        }

        // Get elements
        const icon = selectElement('onboardingIcon');
        const title = selectElement('onboardingStepTitle');
        const content = selectElement('onboardingContent');
        const inputContainer = selectElement('onboardingInput');
        const inputField = selectElement<HTMLInputElement>('onboardingInputField');
        const inputLabel = selectElement('onboardingInputLabel');
        const inputUnit = selectElement('onboardingInputUnit');
        const helpText = selectElement('onboardingHelpText');
        const prevBtn = selectElement<HTMLButtonElement>('onboardingPrev');
        const nextBtn = selectElement<HTMLButtonElement>('onboardingNext');
        const skipBtn = selectElement<HTMLButtonElement>('skipOnboarding');
        const progressDots = selectElement('onboardingProgressDots');

        const elements = { icon, title, content, inputContainer, inputField, inputLabel, inputUnit, helpText, prevBtn, nextBtn, progressDots };

        let currentStep = 0;

        // Save input value for current step
        const saveCurrentInput = (): void => {
            const step = onboardingSteps[currentStep];
            if (step.inputType === 'number' && step.profileKey) {
                const value = inputField.value ? parseFloat(inputField.value) : null;
                if (value !== null && step.profileKey !== 'onboardingComplete' && step.profileKey !== 'lastUpdated') {
                    profile[step.profileKey] = value;
                }
            }
        };

        // Render current step
        const render = (): void => {
            renderStep(onboardingSteps[currentStep], currentStep, profile, elements);
        };

        // Navigation handlers
        const goNext = (): void => {
            // Validate input if it's a number step
            const step = onboardingSteps[currentStep];
            if (step.inputType === 'number') {
                if (!inputField.checkValidity()) {
                    inputField.reportValidity();
                    return;
                }
            }

            saveCurrentInput();

            if (currentStep < onboardingSteps.length - 1) {
                currentStep++;
                render();
            } else {
                // Complete onboarding
                profile.onboardingComplete = true;
                saveUserProfile(profile);
                modal!.style.display = 'none';
                showNotification('Profile saved! Ready to ride 🚴', 'success');
                announce('Onboarding complete. Profile saved.');
                resolve(profile);
            }
        };

        const goPrev = (): void => {
            saveCurrentInput();
            if (currentStep > 0) {
                currentStep--;
                render();
            }
        };

        const skip = (): void => {
            profile.onboardingComplete = true;
            saveUserProfile(profile);
            modal!.style.display = 'none';
            announce('Onboarding skipped');
            resolve(profile);
        };

        // Event listeners
        nextBtn.addEventListener('click', goNext);
        prevBtn.addEventListener('click', goPrev);
        skipBtn.addEventListener('click', skip);

        // Enter key advances
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                goNext();
            }
        });

        // Show modal
        modal.style.display = 'flex';
        render();
        trapFocus(modal.querySelector('.stream-modal-content')!);
    });
}

/**
 * Check if user should see onboarding
 */
export function shouldShowOnboarding(): boolean {
    const profile = loadUserProfile();
    return !profile.onboardingComplete;
}

/**
 * Initialize onboarding - shows wizard if first run
 */
export function initOnboarding(): void {
    if (shouldShowOnboarding()) {
        // Small delay to let the app render first
        setTimeout(() => {
            showOnboarding();
        }, 500);
    }
}

/**
 * Calculate power zones based on FTP (Coggan 7-zone model)
 */
export function calculatePowerZones(ftp: number): { name: string; min: number; max: number }[] {
    return [
        { name: 'Active Recovery', min: 0, max: Math.round(ftp * 0.55) },
        { name: 'Endurance', min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.75) },
        { name: 'Tempo', min: Math.round(ftp * 0.75), max: Math.round(ftp * 0.90) },
        { name: 'Threshold', min: Math.round(ftp * 0.90), max: Math.round(ftp * 1.05) },
        { name: 'VO2max', min: Math.round(ftp * 1.05), max: Math.round(ftp * 1.20) },
        { name: 'Anaerobic', min: Math.round(ftp * 1.20), max: Math.round(ftp * 1.50) },
        { name: 'Neuromuscular', min: Math.round(ftp * 1.50), max: 9999 },
    ];
}

/**
 * Calculate heart rate zones based on max HR (5-zone model)
 */
export function calculateHrZones(maxHr: number): { name: string; min: number; max: number }[] {
    return [
        { name: 'Recovery', min: Math.round(maxHr * 0.50), max: Math.round(maxHr * 0.60) },
        { name: 'Aerobic', min: Math.round(maxHr * 0.60), max: Math.round(maxHr * 0.70) },
        { name: 'Tempo', min: Math.round(maxHr * 0.70), max: Math.round(maxHr * 0.80) },
        { name: 'Threshold', min: Math.round(maxHr * 0.80), max: Math.round(maxHr * 0.90) },
        { name: 'Anaerobic', min: Math.round(maxHr * 0.90), max: maxHr },
    ];
}

/**
 * Get current power zone for a given wattage
 */
export function getPowerZone(power: number, ftp: number): { zone: number; name: string } | null {
    const zones = calculatePowerZones(ftp);
    for (let i = 0; i < zones.length; i++) {
        if (power >= zones[i].min && power < zones[i].max) {
            return { zone: i + 1, name: zones[i].name };
        }
    }
    return null;
}

/**
 * Get current HR zone for a given heart rate
 */
export function getHrZone(hr: number, maxHr: number): { zone: number; name: string } | null {
    const zones = calculateHrZones(maxHr);
    for (let i = 0; i < zones.length; i++) {
        if (hr >= zones[i].min && hr <= zones[i].max) {
            return { zone: i + 1, name: zones[i].name };
        }
    }
    return null;
}
