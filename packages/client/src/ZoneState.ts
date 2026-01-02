/**
 * Zone State Management
 * 
 * Tracks time spent in each power and heart rate zone during a workout.
 * Integrates with UserProfile for zone thresholds.
 * 
 * @module ZoneState
 */

/**
 * User profile for zone calculations
 */
interface UserProfile {
    ftp: number | null;
    maxHr: number | null;
}

/** Storage key for user profile */
const PROFILE_KEY = 'bpt-user-profile';

/**
 * Load user profile from localStorage
 */
function loadUserProfile(): UserProfile {
    try {
        const stored = localStorage.getItem(PROFILE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load user profile:', e);
    }
    return { ftp: null, maxHr: null };
}

/**
 * Calculate power zones based on FTP (Coggan 7-zone model)
 */
function calculatePowerZones(ftp: number): { name: string; min: number; max: number }[] {
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
function calculateHrZones(maxHr: number): { name: string; min: number; max: number }[] {
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
function getPowerZone(power: number, ftp: number): { zone: number; name: string } | null {
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
function getHrZone(hr: number, maxHr: number): { zone: number; name: string } | null {
    const zones = calculateHrZones(maxHr);
    for (let i = 0; i < zones.length; i++) {
        if (hr >= zones[i].min && hr <= zones[i].max) {
            return { zone: i + 1, name: zones[i].name };
        }
    }
    return null;
}

/**
 * Zone information with time tracking
 */
export interface ZoneInfo {
    zone: number;
    name: string;
    min: number;
    max: number;
    timeInZoneMs: number;
}

/**
 * Current zone status for real-time display
 */
export interface CurrentZoneStatus {
    zone: number;
    name: string;
    percentInZone: number; // 0-100, position within zone range
}

/**
 * Zone distribution data for summary
 */
export interface ZoneDistribution {
    zones: ZoneInfo[];
    totalTimeMs: number;
}

/**
 * State change callback type
 */
export type ZoneStateChangeCallback = () => void;

/**
 * Zone State class for tracking time in zones
 */
export class ZoneState {
    private _powerZones: ZoneInfo[] = [];
    private _hrZones: ZoneInfo[] = [];
    private _lastPowerZone: number | null = null;
    private _lastHrZone: number | null = null;
    private _lastUpdateTime: number | null = null;
    private _ftp: number | null = null;
    private _maxHr: number | null = null;
    private _currentPowerZone: CurrentZoneStatus | null = null;
    private _currentHrZone: CurrentZoneStatus | null = null;
    private _onChangeCallbacks: ZoneStateChangeCallback[] = [];

    constructor() {
        this.loadProfile();
    }

    /**
     * Load user profile and initialize zones
     */
    loadProfile(): void {
        const profile = loadUserProfile();
        this._ftp = profile.ftp;
        this._maxHr = profile.maxHr;

        // Initialize power zones
        if (this._ftp) {
            const powerZonesDef = calculatePowerZones(this._ftp);
            this._powerZones = powerZonesDef.map((z, i) => ({
                zone: i + 1,
                name: z.name,
                min: z.min,
                max: z.max,
                timeInZoneMs: 0,
            }));
        }

        // Initialize HR zones
        if (this._maxHr) {
            const hrZonesDef = calculateHrZones(this._maxHr);
            this._hrZones = hrZonesDef.map((z, i) => ({
                zone: i + 1,
                name: z.name,
                min: z.min,
                max: z.max,
                timeInZoneMs: 0,
            }));
        }
    }

    /**
     * Register a callback for state changes
     */
    onChange(callback: ZoneStateChangeCallback): void {
        this._onChangeCallbacks.push(callback);
    }

    /**
     * Remove a state change callback
     */
    offChange(callback: ZoneStateChangeCallback): void {
        const index = this._onChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this._onChangeCallbacks.splice(index, 1);
        }
    }

    /**
     * Notify listeners of state change
     */
    private _notifyChange(): void {
        for (const callback of this._onChangeCallbacks) {
            try {
                callback();
            } catch (e) {
                console.error('Zone state change callback error:', e);
            }
        }
    }

    /**
     * Update power value and track zone time
     */
    updatePower(power: number, timestamp: number = Date.now()): CurrentZoneStatus | null {
        if (!this._ftp) return null;

        const zoneInfo = getPowerZone(power, this._ftp);
        if (!zoneInfo) return null;

        const currentZone = zoneInfo.zone;

        // Track time in zone
        if (this._lastUpdateTime !== null && this._lastPowerZone !== null) {
            const timeDelta = timestamp - this._lastUpdateTime;
            const zoneData = this._powerZones[this._lastPowerZone - 1];
            if (zoneData && timeDelta > 0 && timeDelta < 5000) {
                // Only count if less than 5 seconds (avoid large gaps)
                zoneData.timeInZoneMs += timeDelta;
            }
        }

        this._lastPowerZone = currentZone;
        this._lastUpdateTime = timestamp;

        // Calculate position within zone
        const zoneData = this._powerZones[currentZone - 1];
        const range = zoneData.max - zoneData.min;
        const percentInZone = range > 0
            ? Math.min(100, Math.max(0, ((power - zoneData.min) / range) * 100))
            : 50;

        this._currentPowerZone = {
            zone: currentZone,
            name: zoneInfo.name,
            percentInZone,
        };

        this._notifyChange();
        return this._currentPowerZone;
    }

    /**
     * Update heart rate value and track zone time
     */
    updateHeartRate(hr: number, timestamp: number = Date.now()): CurrentZoneStatus | null {
        if (!this._maxHr) return null;

        const zoneInfo = getHrZone(hr, this._maxHr);
        if (!zoneInfo) return null;

        const currentZone = zoneInfo.zone;

        // Track time in zone
        if (this._lastUpdateTime !== null && this._lastHrZone !== null) {
            const timeDelta = timestamp - this._lastUpdateTime;
            const zoneData = this._hrZones[this._lastHrZone - 1];
            if (zoneData && timeDelta > 0 && timeDelta < 5000) {
                zoneData.timeInZoneMs += timeDelta;
            }
        }

        this._lastHrZone = currentZone;
        // Only update if no power update occurred (prevent double counting)
        if (this._lastUpdateTime === null || timestamp - this._lastUpdateTime > 50) {
            this._lastUpdateTime = timestamp;
        }

        // Calculate position within zone
        const zoneData = this._hrZones[currentZone - 1];
        const range = zoneData.max - zoneData.min;
        const percentInZone = range > 0
            ? Math.min(100, Math.max(0, ((hr - zoneData.min) / range) * 100))
            : 50;

        this._currentHrZone = {
            zone: currentZone,
            name: zoneInfo.name,
            percentInZone,
        };

        this._notifyChange();
        return this._currentHrZone;
    }

    /**
     * Get current power zone status
     */
    getCurrentPowerZone(): CurrentZoneStatus | null {
        return this._currentPowerZone;
    }

    /**
     * Get current HR zone status
     */
    getCurrentHrZone(): CurrentZoneStatus | null {
        return this._currentHrZone;
    }

    /**
     * Get power zone distribution for summary
     */
    getPowerZoneDistribution(): ZoneDistribution {
        const totalTimeMs = this._powerZones.reduce((sum, z) => sum + z.timeInZoneMs, 0);
        return {
            zones: [...this._powerZones],
            totalTimeMs,
        };
    }

    /**
     * Get HR zone distribution for summary
     */
    getHrZoneDistribution(): ZoneDistribution {
        const totalTimeMs = this._hrZones.reduce((sum, z) => sum + z.timeInZoneMs, 0);
        return {
            zones: [...this._hrZones],
            totalTimeMs,
        };
    }

    /**
     * Check if power zones are configured
     */
    hasPowerZones(): boolean {
        return this._ftp !== null && this._ftp > 0;
    }

    /**
     * Check if HR zones are configured
     */
    hasHrZones(): boolean {
        return this._maxHr !== null && this._maxHr > 0;
    }

    /**
     * Get FTP value
     */
    getFtp(): number | null {
        return this._ftp;
    }

    /**
     * Get Max HR value
     */
    getMaxHr(): number | null {
        return this._maxHr;
    }

    /**
     * Reset all zone tracking data
     */
    reset(): void {
        this._powerZones.forEach(z => z.timeInZoneMs = 0);
        this._hrZones.forEach(z => z.timeInZoneMs = 0);
        this._lastPowerZone = null;
        this._lastHrZone = null;
        this._lastUpdateTime = null;
        this._currentPowerZone = null;
        this._currentHrZone = null;
        this._notifyChange();
    }

    /**
     * Export zone data as JSON (for exports/summary)
     */
    toJSON(): {
        powerZones: ZoneInfo[];
        hrZones: ZoneInfo[];
        ftp: number | null;
        maxHr: number | null;
    } {
        return {
            powerZones: [...this._powerZones],
            hrZones: [...this._hrZones],
            ftp: this._ftp,
            maxHr: this._maxHr,
        };
    }
}
