/**
 * Validation limits for measurement values
 */
export const VALIDATION_LIMITS = {
    heartrate: { min: 0, max: 300 },
    power: { min: 0, max: 3000 },
    cadence: { min: 0, max: 300 },
    speed: { min: 0, max: 150 }, // km/h
    distance: { min: 0, max: 1000000 }, // meters
    altitude: { min: -500, max: 9000 }, // meters
} as const;
