/**
 * Data Screen Configuration Types
 * 
 * Defines the structure for configurable data screens and activity profiles.
 * Users can create multiple screens with different data field layouts,
 * similar to Garmin/Wahoo bike computers.
 * 
 * @module data-fields/screens
 */

import type {
    DataFieldSize,
    DataFieldSlot,
    DataScreen,
    ActivityProfile,
    ScreenLayout,
    ActivityType,
} from './types.js';

// Re-export types for backward compatibility
export type {
    DataFieldSlot,
    DataScreen,
    ActivityProfile,
    ScreenLayout,
    ActivityType,
};

// ============================================================================
// Data Field Settings
// ============================================================================

/**
 * Per-field preferences and alert settings
 */
export interface FieldPreferences {
    /** Show this field in workout summary */
    showInSummary: boolean;
    /** Announce this field via voice */
    voiceAnnounce: boolean;
    /** Optional alert threshold value */
    alertThreshold?: number;
    /** Alert when value goes above or below threshold */
    alertType?: 'above' | 'below';
    /** Custom color override */
    customColor?: string;
}

/**
 * Complete data field settings stored in user preferences
 */
export interface DataFieldSettings {
    /** All activity profiles */
    profiles: ActivityProfile[];
    /** Currently active profile ID */
    activeProfileId: string;
    /** Unit system preference */
    unitSystem: 'metric' | 'imperial';
    /** Per-field preferences keyed by field ID */
    fieldPreferences: Record<string, FieldPreferences>;
    /** Schema version for migrations */
    version: number;
}

// ============================================================================
// Screen Utility Functions
// ============================================================================

/**
 * Generate a unique slot ID
 */
export function generateSlotId(): string {
    return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique screen ID
 */
export function generateScreenId(): string {
    return `screen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique profile ID
 */
export function generateProfileId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create an empty data screen with default settings
 */
export function createEmptyScreen(name: string, icon: string = '📊'): DataScreen {
    return {
        id: generateScreenId(),
        name,
        icon,
        layout: 'auto',
        slots: [],
    };
}

/**
 * Create a data field slot
 */
export function createSlot(
    fieldId: string,
    size: DataFieldSize = 'medium',
    position: number = 1
): DataFieldSlot {
    return {
        id: generateSlotId(),
        fieldId,
        size,
        position,
    };
}

/**
 * Create an empty activity profile
 */
export function createEmptyProfile(
    name: string,
    activityType: ActivityType,
    icon: string = '🚴'
): ActivityProfile {
    return {
        id: generateProfileId(),
        name,
        activityType,
        icon,
        screens: [createEmptyScreen('Main', '📊')],
        activeScreenIndex: 0,
    };
}

/**
 * Add a slot to a screen
 */
export function addSlotToScreen(
    screen: DataScreen,
    fieldId: string,
    size: DataFieldSize = 'medium'
): DataScreen {
    const position = screen.slots.length + 1;
    return {
        ...screen,
        slots: [...screen.slots, createSlot(fieldId, size, position)],
    };
}

/**
 * Remove a slot from a screen
 */
export function removeSlotFromScreen(
    screen: DataScreen,
    slotId: string
): DataScreen {
    const filteredSlots = screen.slots.filter(s => s.id !== slotId);
    // Reorder positions
    const reorderedSlots = filteredSlots.map((slot, index) => ({
        ...slot,
        position: index + 1,
    }));
    return {
        ...screen,
        slots: reorderedSlots,
    };
}

/**
 * Update a slot's field or size
 */
export function updateSlot(
    screen: DataScreen,
    slotId: string,
    updates: Partial<Pick<DataFieldSlot, 'fieldId' | 'size'>>
): DataScreen {
    return {
        ...screen,
        slots: screen.slots.map(slot =>
            slot.id === slotId ? { ...slot, ...updates } : slot
        ),
    };
}

/**
 * Reorder slots in a screen
 */
export function reorderSlots(
    screen: DataScreen,
    slotIds: string[]
): DataScreen {
    const slotMap = new Map(screen.slots.map(s => [s.id, s]));
    const reorderedSlots = slotIds
        .map((id, index) => {
            const slot = slotMap.get(id);
            if (!slot) return null;
            return { ...slot, position: index + 1 };
        })
        .filter((s): s is DataFieldSlot => s !== null);

    return {
        ...screen,
        slots: reorderedSlots,
    };
}

/**
 * Add a screen to a profile
 */
export function addScreenToProfile(
    profile: ActivityProfile,
    screen: DataScreen
): ActivityProfile {
    return {
        ...profile,
        screens: [...profile.screens, screen],
    };
}

/**
 * Remove a screen from a profile
 */
export function removeScreenFromProfile(
    profile: ActivityProfile,
    screenId: string
): ActivityProfile {
    const filteredScreens = profile.screens.filter(s => s.id !== screenId);
    // Ensure at least one screen exists
    if (filteredScreens.length === 0) {
        filteredScreens.push(createEmptyScreen('Main'));
    }
    // Adjust active index if needed
    const activeIndex = Math.min(
        profile.activeScreenIndex,
        filteredScreens.length - 1
    );
    return {
        ...profile,
        screens: filteredScreens,
        activeScreenIndex: activeIndex,
    };
}

/**
 * Get the currently active screen from a profile
 */
export function getActiveScreen(profile: ActivityProfile): DataScreen {
    return profile.screens[profile.activeScreenIndex] || profile.screens[0];
}

/**
 * Set the active screen index
 */
export function setActiveScreenIndex(
    profile: ActivityProfile,
    index: number
): ActivityProfile {
    const safeIndex = Math.max(0, Math.min(index, profile.screens.length - 1));
    return {
        ...profile,
        activeScreenIndex: safeIndex,
    };
}

/**
 * Navigate to next screen
 */
export function nextScreen(profile: ActivityProfile): ActivityProfile {
    const nextIndex = (profile.activeScreenIndex + 1) % profile.screens.length;
    return setActiveScreenIndex(profile, nextIndex);
}

/**
 * Navigate to previous screen
 */
export function previousScreen(profile: ActivityProfile): ActivityProfile {
    const prevIndex = profile.activeScreenIndex === 0
        ? profile.screens.length - 1
        : profile.activeScreenIndex - 1;
    return setActiveScreenIndex(profile, prevIndex);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a data screen configuration
 */
export function validateScreen(screen: DataScreen): string[] {
    const errors: string[] = [];

    if (!screen.id) {
        errors.push('Screen must have an ID');
    }
    if (!screen.name || screen.name.trim().length === 0) {
        errors.push('Screen must have a name');
    }
    if (screen.slots.length === 0) {
        errors.push('Screen must have at least one data field');
    }
    if (screen.slots.length > 12) {
        errors.push('Screen cannot have more than 12 data fields');
    }

    // Check for duplicate slot IDs
    const slotIds = screen.slots.map(s => s.id);
    const uniqueIds = new Set(slotIds);
    if (slotIds.length !== uniqueIds.size) {
        errors.push('Screen has duplicate slot IDs');
    }

    return errors;
}

/**
 * Validate an activity profile
 */
export function validateProfile(profile: ActivityProfile): string[] {
    const errors: string[] = [];

    if (!profile.id) {
        errors.push('Profile must have an ID');
    }
    if (!profile.name || profile.name.trim().length === 0) {
        errors.push('Profile must have a name');
    }
    if (profile.screens.length === 0) {
        errors.push('Profile must have at least one screen');
    }
    if (profile.screens.length > 10) {
        errors.push('Profile cannot have more than 10 screens');
    }
    if (profile.activeScreenIndex < 0 || profile.activeScreenIndex >= profile.screens.length) {
        errors.push('Invalid active screen index');
    }

    // Validate each screen
    for (const screen of profile.screens) {
        const screenErrors = validateScreen(screen);
        errors.push(...screenErrors.map(e => `Screen "${screen.name}": ${e}`));
    }

    return errors;
}
