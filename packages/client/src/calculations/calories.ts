/**
 * Calorie calculation utilities
 * 
 * Provides methods to estimate energy expenditure from power (preferred)
 * or heart rate (fallback).
 */

/**
 * Calculate calories burned based on mechanical work (Power).
 * Uses the standard conversion where 1 kJ of mechanical work ≈ 1 kcal of energy expenditure.
 * This assumes a mechanical efficiency of ~24% (1 kcal = 4.184 kJ).
 * 
 * @param powerWatts - Average power in Watts
 * @param durationSeconds - Duration in seconds
 * @returns Energy expenditure in kcal
 */
export function calculateCaloriesFromPower(powerWatts: number, durationSeconds: number): number {
    if (powerWatts <= 0 || durationSeconds <= 0) return 0;

    // Energy (Joules) = Power (Watts) * Time (Seconds)
    const joules = powerWatts * durationSeconds;

    // Convert to kJ (which is approx equal to kcal due to human efficiency)
    return joules / 1000;
}

/**
 * Calculate calories burned based on Heart Rate.
 * Uses a simplified prediction equation (Keytel et al.) with default assumptions
 * for missing demographic data (Male, 30 years old).
 * 
 * @param heartRate - Average heart rate in bpm
 * @param weightKg - User weight in kg
 * @param durationSeconds - Duration in seconds
 * @returns Energy expenditure in kcal
 */
export function calculateCaloriesFromHeartRate(heartRate: number, weightKg: number, durationSeconds: number): number {
    if (heartRate <= 0 || weightKg <= 0 || durationSeconds <= 0) return 0;

    // Default parameters if not provided in settings
    const age = 30; // Default age
    // Formula for Male: Cal = [(Age x 0.2017) + (Weight x 0.1988) + (HR x 0.6309) — 55.0969] x Time / 4.184
    // Time in minutes

    const minutes = durationSeconds / 60;

    const termAge = age * 0.2017;
    const termWeight = weightKg * 0.1988;
    const termHr = heartRate * 0.6309;

    const caloriesPerMinute = (termAge + termWeight + termHr - 55.0969) / 4.184;

    return Math.max(0, caloriesPerMinute * minutes);
}
