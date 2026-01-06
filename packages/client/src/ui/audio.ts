/**
 * Audio cues for workouts and notifications
 * Using Web Audio API for synthetic sounds (no assets needed)
 * and SpeechSynthesis for voice announcements.
 */

class AudioController {
    private audioCtx: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private isMuted: boolean = false;

    constructor() {
        // Initialize AudioContext on first user interaction if possible
        // But for now we just prepare it.
        // Modern browsers require user gesture to resume AudioContext.
    }

    public init() {
        this.ensureContext();
    }

    private ensureContext() {
        if (!this.audioCtx) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (Ctx) {
                this.audioCtx = new Ctx();
                this.gainNode = this.audioCtx.createGain();
                this.gainNode.connect(this.audioCtx.destination);
                this.gainNode.gain.value = 0.5; // Default volume
            }
        }

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    public setMuted(muted: boolean) {
        this.isMuted = muted;
    }

    /**
     * Play a synthesized beep
     * @param freq Frequency in Hz
     * @param duration Duration in ms
     * @param type Oscillator type
     */
    public beep(freq: number = 440, duration: number = 200, type: OscillatorType = 'sine') {
        if (this.isMuted) return;
        this.ensureContext();

        if (!this.audioCtx || !this.gainNode) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        // Envelope to avoid clicking
        gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, this.audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + (duration / 1000));

        osc.connect(gain);
        gain.connect(this.gainNode);

        osc.start();
        osc.stop(this.audioCtx.currentTime + (duration / 1000));
    }

    /**
     * Play a sequence of beeps (e.g. countdown)
     * High pitch: 880Hz, Low pitch: 440Hz
     */
    public playCountdown() {
        this.beep(440, 150); // 3
    }

    public playStart() {
        this.beep(880, 400); // GO
    }

    public playSuccess() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.audioCtx || !this.gainNode) return;

        const now = this.audioCtx.currentTime;

        // Arpeggio C E G
        this.scheduleNote(523.25, now, 0.1);
        this.scheduleNote(659.25, now + 0.1, 0.1);
        this.scheduleNote(783.99, now + 0.2, 0.2);
    }

    private scheduleNote(freq: number, startTime: number, duration: number) {
        if (!this.audioCtx || !this.gainNode) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.gainNode);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    /**
     * Speak text using SpeechSynthesis
     */
    public speak(text: string) {
        if (this.isMuted || !window.speechSynthesis) return;

        // Cancel current utterance
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
    }
}

export const audioManager = new AudioController();
