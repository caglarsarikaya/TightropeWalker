/**
 * Settings.js
 * Player preferences and personal records, saved in localStorage.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded and the game works with defaults.
 */

const STORAGE_KEY = 'tightrope-walker:v1';

const DEFAULTS = Object.freeze({
    difficulty: 'normal',     // easy | normal | hard
    quality: 'high',          // high | low
    cameraSensitivity: 1,     // 0.4 .. 2
    invertY: false,
    volume: 0.7,              // 0 .. 1
    muted: false,
    hints: true
});

class Settings {
    constructor() {
        this.values = { ...DEFAULTS };
        this.records = { bestTime: null, bestDistance: 0, runs: 0 };
        this.promptCounts = {};
        this.listeners = [];
        this.load();
    }

    load() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.values = { ...DEFAULTS, ...(data.values || {}) };
            this.records = { ...this.records, ...(data.records || {}) };
            this.promptCounts = data.promptCounts || {};
        } catch {
            // Ignore unreadable storage and keep defaults
        }
    }

    save() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                values: this.values,
                records: this.records,
                promptCounts: this.promptCounts
            }));
        } catch {
            // Storage blocked or full: settings just won't persist
        }
    }

    get(key) {
        return this.values[key];
    }

    set(key, value) {
        if (this.values[key] === value) return;
        this.values[key] = value;
        this.save();
        for (const listener of this.listeners) listener(key, value);
    }

    /**
     * @param {Function} listener - Called with (key, value) on every change
     */
    onChange(listener) {
        this.listeners.push(listener);
    }

    /**
     * Record a finished run
     * @returns {{newBestTime: boolean, newBestDistance: boolean}}
     */
    recordRun({ success, time, distance }) {
        const result = { newBestTime: false, newBestDistance: false };
        this.records.runs += 1;

        if (success && (this.records.bestTime === null || time < this.records.bestTime)) {
            this.records.bestTime = time;
            result.newBestTime = true;
        }
        if (distance > this.records.bestDistance + 0.5) {
            this.records.bestDistance = distance;
            result.newBestDistance = true;
        }

        this.save();
        return result;
    }

    resetRecords() {
        this.records = { bestTime: null, bestDistance: 0, runs: 0 };
        this.promptCounts = {};
        this.save();
    }

    /**
     * How many runs a tutorial prompt has already been shown in
     */
    promptCount(id) {
        return this.promptCounts[id] || 0;
    }

    countPrompt(id) {
        this.promptCounts[id] = this.promptCount(id) + 1;
        this.save();
    }
}

export { Settings };
