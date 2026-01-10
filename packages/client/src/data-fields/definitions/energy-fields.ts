import type { DataFieldDefinition, DataFieldCalculator, DataFieldFormatter, WorkoutState, UserSettings } from '../types.js';
import type { MeasurementsState } from '../../measurements-state.js';

const calorieCalculator: DataFieldCalculator = (measurements: MeasurementsState, _workoutState: WorkoutState, settings: UserSettings) => {
    if (!settings.showCalories) return null;
    if (!measurements.energy || measurements.energy.length === 0) return 0;
    return measurements.energy[measurements.energy.length - 1].value;
};

const calorieRateCalculator: DataFieldCalculator = (measurements: MeasurementsState, _workoutState: WorkoutState, settings: UserSettings) => {
    if (!settings.showCalories) return null;

    // If power is present, use Power * 3.6
    const power = measurements.power.length > 0 ? measurements.power[measurements.power.length - 1].value : 0;
    if (power > 0) {
        return power * 3.6;
    }

    const hr = measurements.heartrate.length > 0 ? measurements.heartrate[measurements.heartrate.length - 1].value : 0;
    if (hr > 0) {
        const weight = settings.weight || 75;
        const age = 30; // Default
        const termAge = age * 0.2017;
        const termWeight = weight * 0.1988;
        const termHr = hr * 0.6309;
        const calPerMin = (termAge + termWeight + termHr - 55.0969) / 4.184;
        return Math.max(0, calPerMin * 60);
    }

    return 0;
};

const defaultFormatter: DataFieldFormatter = (value: number | null) => {
    if (value === null) return '--';
    return Math.round(value).toString();
};

export const energyFields: DataFieldDefinition[] = [
    {
        id: 'calories_total',
        name: 'Calories',
        shortName: 'Cals',
        category: 'energy',
        sourceType: 'calculated',
        updateFrequency: 'second',
        description: 'Total energy expenditure in kcal',
        calculator: calorieCalculator,
        formatter: defaultFormatter,
        unit: 'kcal',
        icon: '🔥',
        defaultSize: 'medium',
        supportedSizes: ['small', 'medium', 'large', 'wide', 'tall', 'full']
    },
    {
        id: 'calories_hour',
        name: 'Calories/Hr',
        shortName: 'Cal/h',
        category: 'energy',
        sourceType: 'calculated',
        updateFrequency: 'realtime',
        description: 'Current calorie burn rate',
        calculator: calorieRateCalculator,
        formatter: defaultFormatter,
        unit: 'kcal/h',
        icon: '🔥',
        defaultSize: 'medium',
        supportedSizes: ['small', 'medium', 'large', 'wide', 'tall']
    }
];
