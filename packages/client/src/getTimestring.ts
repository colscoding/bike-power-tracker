/**
 * Time formatting utilities
 * 
 * @module getTimestring
 */

/**
 * Converts milliseconds to a formatted time string (HH:MM:SS)
 * 
 * @param milliseconds - Time duration in milliseconds
 * @returns Formatted time string in HH:MM:SS format
 * 
 * @example
 * getTimestring(3661000) // "01:01:01"
 * getTimestring(0)       // "00:00:00"
 */
export const getTimestring = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return (
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`
    );
};
