/**
 * Dark Mode Module
 * Handles theme switching and persistence for the app
 */

const DARK_MODE_KEY = 'bpt-dark-mode';

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Get the stored theme preference from localStorage
 */
export function getStoredThemePreference(): ThemePreference | null {
    try {
        const stored = localStorage.getItem(DARK_MODE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Save theme preference to localStorage
 */
export function saveThemePreference(preference: ThemePreference): void {
    try {
        localStorage.setItem(DARK_MODE_KEY, preference);
    } catch {
        // localStorage might not be available
    }
}

/**
 * Check if the system prefers dark mode
 */
export function systemPrefersDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Apply the theme to the document
 */
export function applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Get the effective theme based on preference
 */
export function getEffectiveTheme(preference: ThemePreference): 'light' | 'dark' {
    if (preference === 'system') {
        return systemPrefersDark() ? 'dark' : 'light';
    }
    return preference;
}

/**
 * Check if dark mode is currently active
 */
export function isDarkMode(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Toggle dark mode on/off
 */
export function toggleDarkMode(): boolean {
    const currentlyDark = isDarkMode();
    const newTheme = currentlyDark ? 'light' : 'dark';
    applyTheme(newTheme);
    saveThemePreference(newTheme);
    return !currentlyDark;
}

/**
 * Initialize dark mode based on stored preference or system preference
 */
export function initDarkMode(): boolean {
    const stored = getStoredThemePreference();

    if (stored) {
        const effectiveTheme = getEffectiveTheme(stored);
        applyTheme(effectiveTheme);
        return effectiveTheme === 'dark';
    }

    // Default to system preference if no stored preference
    const systemDark = systemPrefersDark();
    if (systemDark) {
        applyTheme('dark');
    }
    // Note: Don't save preference when using system default
    return systemDark;
}

/**
 * Set up the dark mode toggle checkbox
 */
export function setupDarkModeToggle(toggleElement: HTMLInputElement): void {
    // Initialize toggle state
    const isDark = initDarkMode();
    toggleElement.checked = isDark;

    // Handle toggle changes
    toggleElement.addEventListener('change', () => {
        const newTheme = toggleElement.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        saveThemePreference(newTheme);
    });

    // Listen for system preference changes (when using system theme)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't set a preference
        const stored = getStoredThemePreference();
        if (!stored || stored === 'system') {
            const newTheme = e.matches ? 'dark' : 'light';
            applyTheme(newTheme);
            toggleElement.checked = e.matches;
        }
    });
}
