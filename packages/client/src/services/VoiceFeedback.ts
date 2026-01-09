import { getSettings } from '../ui/settings.js';

export class VoiceFeedback {
    private synth: SpeechSynthesis | null;
    private voice: SpeechSynthesisVoice | null = null;

    constructor() {
        this.synth = window.speechSynthesis || null;

        if (!this.synth) {
            console.warn('Speech Synthesis not supported on this device');
            return;
        }

        // Wait for voices to be loaded
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoice();
        }
        this.loadVoice();
    }

    private loadVoice() {
        if (!this.synth) return;

        const voices = this.synth.getVoices();
        // Prefer English voices
        this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
    }

    private formatTimeForSpeech(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours} hours`);
        if (minutes > 0) parts.push(`${minutes} minutes`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds} seconds`);

        return parts.join(' ');
    }

    public speak(text: string) {
        if (!this.synth) return;

        const settings = getSettings();
        if (!settings.voiceEnabled) return;

        if (this.synth.speaking) {
            this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) {
            utterance.voice = this.voice;
        }
        this.synth.speak(utterance);
    }

    public announceLap(lapNumber: number, timeMs: number, avgPower: number) {
        if (!this.synth) return;

        const settings = getSettings();
        if (!settings.voiceLaps) return;

        const timeStr = this.formatTimeForSpeech(timeMs);
        const text = `Lap ${lapNumber}. Time ${timeStr}. Average Power ${Math.round(avgPower)} watts.`;
        this.speak(text);
    }

    public announceZoneChange(zoneName: string) {
        if (!this.synth) return;

        const settings = getSettings();
        if (!settings.voiceZones) return;

        const text = `Entering ${zoneName} Zone`;
        this.speak(text);
    }
}

export const voiceFeedback = new VoiceFeedback();
