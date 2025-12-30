/**
 * Realistic workout data generator
 * 
 * Generates cycling workout data that mimics real-world patterns including:
 * - Physiologically accurate heart rate response to power changes
 * - Realistic cadence patterns
 * - Different workout profiles (endurance, intervals, sprints, etc.)
 * - Fatigue simulation over time
 * 
 * @module workout-generator
 */

import { config, clamp, gaussianRandom } from './config.js';

/**
 * Athlete profile representing fitness characteristics
 * @typedef {Object} AthleteProfile
 * @property {number} ftp - Functional Threshold Power (watts)
 * @property {number} maxHr - Maximum heart rate
 * @property {number} restingHr - Resting heart rate
 * @property {number} preferredCadence - Preferred cadence (RPM)
 * @property {number} weight - Body weight in kg (for w/kg calculations)
 */

/**
 * Current workout state
 * @typedef {Object} WorkoutState
 * @property {number} power - Current power (watts)
 * @property {number} cadence - Current cadence (RPM)
 * @property {number} heartrate - Current heart rate (BPM)
 * @property {number} targetPower - Target power for current phase
 * @property {number} fatigue - Fatigue factor (0-1)
 * @property {number} elapsedSeconds - Elapsed workout time
 */

/**
 * Workout phase definition
 * @typedef {Object} WorkoutPhase
 * @property {string} name - Phase name
 * @property {number} duration - Duration in seconds
 * @property {number} intensityMin - Minimum intensity (% of FTP)
 * @property {number} intensityMax - Maximum intensity (% of FTP)
 * @property {number} [cadenceTarget] - Target cadence (optional)
 */

/**
 * Create a random athlete profile
 * @returns {AthleteProfile}
 */
export function createAthleteProfile() {
    const ftp = Math.floor(gaussianRandom(200, 40)); // Range roughly 120-280W
    const maxHr = Math.floor(gaussianRandom(185, 10)); // Range roughly 165-205
    const restingHr = Math.floor(gaussianRandom(60, 8)); // Range roughly 45-75

    return {
        ftp: clamp(ftp, 100, 350),
        maxHr: clamp(maxHr, 160, 210),
        restingHr: clamp(restingHr, 40, 80),
        preferredCadence: Math.floor(gaussianRandom(90, 8)),
        weight: Math.floor(gaussianRandom(75, 12)),
    };
}

/**
 * Workout profile definitions
 * Each profile defines a series of phases with intensity targets
 */
export const WORKOUT_PROFILES = {
    /**
     * Steady-state endurance workout
     * Long periods at moderate intensity (60-75% FTP)
     */
    endurance: [
        { name: 'warmup', duration: 300, intensityMin: 0.45, intensityMax: 0.55 },
        { name: 'build', duration: 180, intensityMin: 0.55, intensityMax: 0.65 },
        { name: 'main', duration: 2400, intensityMin: 0.65, intensityMax: 0.75 },
        { name: 'cooldown', duration: 300, intensityMin: 0.45, intensityMax: 0.55 },
    ],

    /**
     * High-intensity intervals
     * Alternating hard efforts with recovery
     */
    intervals: [
        { name: 'warmup', duration: 300, intensityMin: 0.45, intensityMax: 0.55 },
        // 5x (3 min hard / 2 min easy)
        { name: 'interval-1', duration: 180, intensityMin: 0.90, intensityMax: 1.05 },
        { name: 'recovery-1', duration: 120, intensityMin: 0.45, intensityMax: 0.55 },
        { name: 'interval-2', duration: 180, intensityMin: 0.90, intensityMax: 1.05 },
        { name: 'recovery-2', duration: 120, intensityMin: 0.45, intensityMax: 0.55 },
        { name: 'interval-3', duration: 180, intensityMin: 0.90, intensityMax: 1.05 },
        { name: 'recovery-3', duration: 120, intensityMin: 0.45, intensityMax: 0.55 },
        { name: 'interval-4', duration: 180, intensityMin: 0.90, intensityMax: 1.05 },
        { name: 'recovery-4', duration: 120, intensityMin: 0.45, intensityMax: 0.55 },
        { name: 'interval-5', duration: 180, intensityMin: 0.90, intensityMax: 1.05 },
        { name: 'cooldown', duration: 300, intensityMin: 0.45, intensityMax: 0.55 },
    ],

    /**
     * Sprint workout
     * Short maximum efforts with full recovery
     */
    sprint: [
        { name: 'warmup', duration: 600, intensityMin: 0.50, intensityMax: 0.65 },
        // 8x (20s sprint / 2 min recovery)
        { name: 'sprint-1', duration: 20, intensityMin: 1.50, intensityMax: 2.00, cadenceTarget: 110 },
        { name: 'recovery-1', duration: 120, intensityMin: 0.35, intensityMax: 0.45 },
        { name: 'sprint-2', duration: 20, intensityMin: 1.50, intensityMax: 2.00, cadenceTarget: 110 },
        { name: 'recovery-2', duration: 120, intensityMin: 0.35, intensityMax: 0.45 },
        { name: 'sprint-3', duration: 20, intensityMin: 1.50, intensityMax: 2.00, cadenceTarget: 110 },
        { name: 'recovery-3', duration: 120, intensityMin: 0.35, intensityMax: 0.45 },
        { name: 'sprint-4', duration: 20, intensityMin: 1.50, intensityMax: 2.00, cadenceTarget: 110 },
        { name: 'recovery-4', duration: 120, intensityMin: 0.35, intensityMax: 0.45 },
        { name: 'sprint-5', duration: 20, intensityMin: 1.50, intensityMax: 2.00, cadenceTarget: 110 },
        { name: 'recovery-5', duration: 120, intensityMin: 0.35, intensityMax: 0.45 },
        { name: 'cooldown', duration: 300, intensityMin: 0.40, intensityMax: 0.50 },
    ],

    /**
     * Recovery ride
     * Very easy effort to promote recovery
     */
    recovery: [
        { name: 'easy', duration: 1800, intensityMin: 0.40, intensityMax: 0.55 },
    ],

    /**
     * Random workout
     * Unpredictable pattern for testing
     */
    random: [
        { name: 'varied', duration: 3600, intensityMin: 0.30, intensityMax: 1.20 },
    ],
};

/**
 * Workout generator class
 * Maintains state and generates realistic workout data over time
 */
export class WorkoutGenerator {
    /**
     * @param {AthleteProfile} [athlete] - Athlete profile (random if not provided)
     * @param {string} [profileName] - Workout profile name
     */
    constructor(athlete = null, profileName = config.profile) {
        this.athlete = athlete || createAthleteProfile();
        this.profileName = profileName;
        this.phases = WORKOUT_PROFILES[profileName] || WORKOUT_PROFILES.random;

        this.currentPhaseIndex = 0;
        this.phaseElapsedSeconds = 0;

        /** @type {WorkoutState} */
        this.state = {
            power: Math.floor(this.athlete.ftp * 0.5),
            cadence: this.athlete.preferredCadence,
            heartrate: this.athlete.restingHr + 30,
            targetPower: Math.floor(this.athlete.ftp * 0.5),
            fatigue: 0,
            elapsedSeconds: 0,
        };

        // Heart rate response lag (simulates physiological delay)
        this.hrHistory = [];
        this.hrLagSeconds = 15;
    }

    /**
     * Get the current workout phase
     * @returns {WorkoutPhase}
     */
    getCurrentPhase() {
        return this.phases[this.currentPhaseIndex] || this.phases[this.phases.length - 1];
    }

    /**
     * Advance to next phase if current one is complete
     */
    checkPhaseTransition() {
        const phase = this.getCurrentPhase();
        if (this.phaseElapsedSeconds >= phase.duration) {
            this.currentPhaseIndex = Math.min(this.currentPhaseIndex + 1, this.phases.length - 1);
            this.phaseElapsedSeconds = 0;
        }
    }

    /**
     * Calculate target power for current phase
     * @returns {number} Target power in watts
     */
    calculateTargetPower() {
        const phase = this.getCurrentPhase();
        const intensityRange = phase.intensityMax - phase.intensityMin;

        // Add some variation within the intensity range
        let intensity;
        if (this.profileName === 'random') {
            // Random profile: more chaotic variation
            intensity = phase.intensityMin + Math.random() * intensityRange;
        } else {
            // Other profiles: smoother variation with occasional spikes
            const baseIntensity = (phase.intensityMin + phase.intensityMax) / 2;
            intensity = gaussianRandom(baseIntensity, intensityRange / 4);
            intensity = clamp(intensity, phase.intensityMin, phase.intensityMax);
        }

        // Apply fatigue factor (reduces power output over time)
        const fatigueMultiplier = 1 - (this.state.fatigue * 0.15);

        return Math.floor(this.athlete.ftp * intensity * fatigueMultiplier);
    }

    /**
     * Calculate heart rate based on current and recent power
     * Heart rate lags behind power changes by ~15 seconds
     * @returns {number} Calculated heart rate
     */
    calculateHeartRate() {
        // Keep history of recent power values
        this.hrHistory.push(this.state.power);
        if (this.hrHistory.length > this.hrLagSeconds) {
            this.hrHistory.shift();
        }

        // Average power over the lag period
        const avgPower = this.hrHistory.reduce((a, b) => a + b, 0) / this.hrHistory.length;

        // Calculate HR based on power as percentage of FTP
        const intensity = avgPower / this.athlete.ftp;
        const hrRange = this.athlete.maxHr - this.athlete.restingHr;

        // HR responds non-linearly to intensity
        // Below threshold: more linear
        // Above threshold: HR climbs faster
        let hrFraction;
        if (intensity <= 1.0) {
            hrFraction = 0.5 + intensity * 0.4;
        } else {
            hrFraction = 0.9 + (intensity - 1.0) * 0.5;
        }
        hrFraction = clamp(hrFraction, 0.3, 1.0);

        // Add fatigue effect (HR drift)
        const fatigueDrift = this.state.fatigue * 10;

        const targetHr = this.athlete.restingHr + (hrRange * hrFraction) + fatigueDrift;

        // Smooth transition towards target HR
        const hrDelta = targetHr - this.state.heartrate;
        const newHr = this.state.heartrate + hrDelta * 0.1;

        // Add small random variation
        return Math.floor(clamp(newHr + gaussianRandom(0, 2), this.athlete.restingHr, this.athlete.maxHr));
    }

    /**
     * Calculate cadence based on current phase and power
     * @returns {number} Calculated cadence
     */
    calculateCadence() {
        const phase = this.getCurrentPhase();

        // Use phase target if specified, otherwise derive from power
        let targetCadence = phase.cadenceTarget || this.athlete.preferredCadence;

        // Higher power often means lower cadence (grinding) or higher cadence (spinning)
        const intensity = this.state.power / this.athlete.ftp;
        if (intensity > 1.2) {
            // Very high intensity: either high cadence sprint or low cadence grind
            targetCadence = Math.random() > 0.5 ? targetCadence + 15 : targetCadence - 10;
        } else if (intensity < 0.5) {
            // Recovery: slightly lower cadence
            targetCadence = targetCadence - 5;
        }

        // Smooth transition
        const cadenceDelta = targetCadence - this.state.cadence;
        const newCadence = this.state.cadence + cadenceDelta * 0.2;

        // Add variation
        return Math.floor(clamp(newCadence + gaussianRandom(0, 3), 50, 130));
    }

    /**
     * Update fatigue based on accumulated work
     */
    updateFatigue() {
        // Fatigue increases faster at higher intensities
        const intensity = this.state.power / this.athlete.ftp;
        const fatigueRate = intensity > 1.0 ? 0.0003 : 0.0001;

        // Recovery during easy periods
        const recoveryRate = intensity < 0.5 ? 0.0002 : 0;

        this.state.fatigue = clamp(this.state.fatigue + fatigueRate - recoveryRate, 0, 1);
    }

    /**
     * Generate next data point
     * Call this once per second to simulate real-time workout data
     * @returns {Object} Workout data point
     */
    tick() {
        this.state.elapsedSeconds++;
        this.phaseElapsedSeconds++;

        // Check for phase transition
        this.checkPhaseTransition();

        // Update target power
        this.state.targetPower = this.calculateTargetPower();

        // Smooth power transition towards target
        const powerDelta = this.state.targetPower - this.state.power;
        this.state.power = Math.floor(this.state.power + powerDelta * 0.3 + gaussianRandom(0, 5));
        this.state.power = clamp(this.state.power, 0, this.athlete.ftp * 2.5);

        // Update other metrics
        this.state.cadence = this.calculateCadence();
        this.state.heartrate = this.calculateHeartRate();

        // Update fatigue
        this.updateFatigue();

        return this.getData();
    }

    /**
     * Get current workout data
     * @returns {Object} Workout data object
     */
    getData() {
        return {
            power: this.state.power,
            cadence: this.state.cadence,
            heartrate: this.state.heartrate,
            timestamp: Date.now(),
            dataType: 'workout_metrics',
        };
    }

    /**
     * Get workout statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            profile: this.profileName,
            phase: this.getCurrentPhase().name,
            elapsedSeconds: this.state.elapsedSeconds,
            fatigue: Math.round(this.state.fatigue * 100),
            athlete: {
                ftp: this.athlete.ftp,
                maxHr: this.athlete.maxHr,
                weight: this.athlete.weight,
            },
        };
    }
}

/**
 * Convenience function to generate a single workout data point
 * For backwards compatibility with simple use cases
 * @param {Object} [baseValues] - Optional base values
 * @returns {Object} Workout data
 */
export function generateWorkoutData(baseValues = {}) {
    const base = {
        power: baseValues.power || 200,
        cadence: baseValues.cadence || 90,
        heartrate: baseValues.heartrate || 140,
    };

    return {
        power: Math.max(0, base.power + Math.floor(gaussianRandom(0, 15))),
        cadence: Math.max(50, Math.min(130, base.cadence + Math.floor(gaussianRandom(0, 5)))),
        heartrate: Math.max(60, Math.min(200, base.heartrate + Math.floor(gaussianRandom(0, 3)))),
        timestamp: Date.now(),
        dataType: 'workout_metrics',
    };
}
