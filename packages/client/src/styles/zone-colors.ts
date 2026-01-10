/**
 * Zone Colors - TypeScript constants that match CSS tokens
 *
 * IMPORTANT: These values must stay in sync with tokens/colors.css
 * Consider using a build-time extraction tool in the future
 */

export const POWER_ZONE_COLORS = {
    1: '#808080', // Recovery
    2: '#2196f3', // Endurance
    3: '#4caf50', // Tempo
    4: '#ffeb3b', // Threshold
    5: '#ff9800', // VO2max
    6: '#f44336', // Anaerobic
    7: '#9c27b0', // Neuromuscular
} as const;

export const HR_ZONE_COLORS = {
    1: '#808080', // < 60%
    2: '#2196f3', // 60-70%
    3: '#4caf50', // 70-80%
    4: '#ff9800', // 80-90%
    5: '#f44336', // > 90%
} as const;

export type PowerZone = keyof typeof POWER_ZONE_COLORS;
export type HRZone = keyof typeof HR_ZONE_COLORS;

/**
 * Get zone color by zone number
 */
export function getZoneColor(zone: number, type: 'power' | 'hr' = 'power'): string {
    if (type === 'hr') {
        const hrZone = Math.min(Math.max(zone, 1), 5) as HRZone;
        return HR_ZONE_COLORS[hrZone];
    }

    const powerZone = Math.min(Math.max(zone, 1), 7) as PowerZone;
    return POWER_ZONE_COLORS[powerZone];
}

/**
 * Get CSS variable name for zone
 */
export function getZoneCSSVar(zone: number, type: 'power' | 'hr' = 'power'): string {
    if (type === 'hr') {
        return `--hr-zone-${Math.min(Math.max(zone, 1), 5)}-color`;
    }
    return `--zone-${Math.min(Math.max(zone, 1), 7)}-color`;
}

/**
 * Calculate power zone from percentage of FTP
 */
export function getPowerZone(percentFTP: number): PowerZone {
    if (percentFTP < 55) return 1;
    if (percentFTP < 75) return 2;
    if (percentFTP < 90) return 3;
    if (percentFTP < 105) return 4;
    if (percentFTP < 120) return 5;
    if (percentFTP < 150) return 6;
    return 7;
}

/**
 * Calculate HR zone from percentage of max HR
 */
export function getHRZone(percentMaxHR: number): HRZone {
    if (percentMaxHR < 60) return 1;
    if (percentMaxHR < 70) return 2;
    if (percentMaxHR < 80) return 3;
    if (percentMaxHR < 90) return 4;
    return 5;
}
