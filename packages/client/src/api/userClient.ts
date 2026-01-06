/**
 * API client for user operations
 * Handles communication with the user API including FTP history
 *
 * @module userClient
 */

const API_BASE_URL: string = import.meta.env.VITE_API_URL || '';
const API_KEY: string | undefined = import.meta.env.VITE_API_KEY;

export interface FtpHistoryEntry {
    id: string;
    userId: string;
    ftp: number;
    source: string | null;
    createdAt: string;
}

export interface UserSettings {
    theme?: 'light' | 'dark' | 'system';
    units?: 'metric' | 'imperial';
    notifications?: boolean;
    ftp?: number;
}

/**
 * Get user FTP history
 */
export async function getFtpHistory(userId: string): Promise<FtpHistoryEntry[]> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/ftp-history`, {
        headers
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch FTP history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Update user FTP
 */
export async function updateUserFtp(userId: string, ftp: number, source: string = 'manual'): Promise<{ ftp: number }> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/ftp`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ftp, source })
    });

    if (!response.ok) {
        throw new Error(`Failed to update FTP: ${response.statusText}`);
    }

    return response.json();
}
