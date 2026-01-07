/**
 * Application settings stored in localStorage
 */
export interface AppSettings {
    power: boolean;
    cadence: boolean;
    heartrate: boolean;
    exportTcx: boolean;
    exportCsv: boolean;
    exportJson: boolean;
    exportFit: boolean;
}

/**
 * Default settings
 */
export const defaultSettings: AppSettings = {
    power: true,
    cadence: true,
    heartrate: true,
    exportTcx: true,
    exportCsv: true,
    exportJson: false,
    exportFit: false,
};
