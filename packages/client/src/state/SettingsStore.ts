import { openDB, IDBPDatabase } from 'idb';

export interface ZoneDefinition {
    name: string;
    min: number;
    max: number;
    color: string;
}

export interface UserSettings {
    // User profile
    weight: number;          // kg
    height: number;          // cm
    age: number;
    gender: 'male' | 'female' | 'other';
    ftp: number;             // Functional Threshold Power
    maxHeartrate: number;
    restingHeartrate: number;

    // Display preferences
    units: 'metric' | 'imperial';
    dateFormat: 'ISO' | 'US' | 'EU';
    clockFormat: '12h' | '24h';

    // Calculation settings
    energyMethod: 'power' | 'heartrate' | 'combined';
    gapThreshold: number;    // seconds before resetting energy calc
    stalenessThreshold: number; // seconds before data considered stale

    // Power zones (percentage of FTP)
    powerZones: ZoneDefinition[];

    // Heart rate zones (percentage of max HR)
    heartrateZones: ZoneDefinition[];
}

const DEFAULT_SETTINGS: UserSettings = {
    weight: 75,
    height: 175,
    age: 30,
    gender: 'other',
    ftp: 200,
    maxHeartrate: 190,
    restingHeartrate: 60,

    units: 'metric',
    dateFormat: 'ISO',
    clockFormat: '24h',

    energyMethod: 'combined',
    gapThreshold: 20,
    stalenessThreshold: 5,

    powerZones: [
        { name: 'Recovery', min: 0, max: 55, color: '#808080' },
        { name: 'Endurance', min: 55, max: 75, color: '#2196f3' },
        { name: 'Tempo', min: 75, max: 90, color: '#4caf50' },
        { name: 'Threshold', min: 90, max: 105, color: '#ffeb3b' },
        { name: 'VO2max', min: 105, max: 120, color: '#ff9800' },
        { name: 'Anaerobic', min: 120, max: 150, color: '#f44336' },
        { name: 'Neuromuscular', min: 150, max: 1000, color: '#9c27b0' },
    ],

    heartrateZones: [
        { name: 'Recovery', min: 0, max: 60, color: '#808080' },
        { name: 'Endurance', min: 60, max: 70, color: '#2196f3' },
        { name: 'Tempo', min: 70, max: 80, color: '#4caf50' },
        { name: 'Threshold', min: 80, max: 90, color: '#ff9800' },
        { name: 'VO2max', min: 90, max: 100, color: '#f44336' },
    ],
};

type SettingsListener = (settings: UserSettings) => void;

class SettingsStore {
    private settings: UserSettings = { ...DEFAULT_SETTINGS };
    private listeners: SettingsListener[] = [];
    private db: IDBPDatabase | null = null;
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Try-catch block for environments that don't support IndexedDB
        try {
            this.db = await openDB('bpt-settings', 1, {
                upgrade(db) {
                    db.createObjectStore('settings');
                },
            });

            const stored = await this.db.get('settings', 'user');
            if (stored) {
                // Merge stored settings with defaults to handle new fields
                this.settings = { ...DEFAULT_SETTINGS, ...stored };
            }
        } catch (e) {
            console.warn('Settings storage unavailable, using defaults/in-memory:', e);
        }

        this.initialized = true;
        this.notifyListeners();
    }

    get<K extends keyof UserSettings>(key: K): UserSettings[K] {
        return this.settings[key];
    }

    getAll(): UserSettings {
        return { ...this.settings };
    }

    async set<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void> {
        this.settings[key] = value;
        await this.persist();
        this.notifyListeners();
    }

    async setMultiple(updates: Partial<UserSettings>): Promise<void> {
        this.settings = { ...this.settings, ...updates };
        await this.persist();
        this.notifyListeners();
    }

    async reset(): Promise<void> {
        this.settings = { ...DEFAULT_SETTINGS };
        await this.persist();
        this.notifyListeners();
    }

    onChange(listener: SettingsListener): () => void {
        this.listeners.push(listener);
        // Call immediately with current settings
        // listener(this.getAll()); 
        // Logic: maybe we shouldn't call immediate if they just subscribe? 
        // Let's stick to standard observable pattern where it calls on next change.
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    private async persist(): Promise<void> {
        if (this.db) {
            try {
                await this.db.put('settings', this.settings, 'user');
            } catch (e) {
                console.error('Failed to save settings:', e);
            }
        }
    }

    private notifyListeners(): void {
        const settings = this.getAll();
        for (const listener of this.listeners) {
            try {
                listener(settings);
            } catch (e) {
                console.error('Settings listener error:', e);
            }
        }
    }
}

export const settingsStore = new SettingsStore();
