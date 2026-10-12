/**
 * SoundManager.js
 * All sound is synthesized with the Web Audio API, so no audio files are
 * needed: wind that follows the wind strength, rope creaks on footsteps,
 * a heartbeat when close to falling, and small UI / result cues.
 *
 * Browsers only allow audio after a user gesture, so init() is called from
 * the first button press.
 */

class SoundManager {
    constructor() {
        this.context = null;
        this.master = null;
        this.volume = 0.7;
        this.muted = false;

        this.wind = null;
        this.heartbeatTimer = 0;
        this.noiseBuffer = null;
    }

    get ready() {
        return this.context !== null;
    }

    init() {
        if (this.context) {
            if (this.context.state === 'suspended') this.context.resume();
            return;
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.applyVolume();

        // Two seconds of white noise, reused by every noisy sound
        const length = this.context.sampleRate * 2;
        this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

        this.createWind();
    }

    setVolume(volume, muted) {
        this.volume = volume;
        this.muted = muted;
        this.applyVolume();
    }

    applyVolume() {
        if (!this.master) return;
        const value = this.muted ? 0 : this.volume * 0.8;
        this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
    }

    suspend() {
        if (this.context && this.context.state === 'running') this.context.suspend();
    }

    resume() {
        if (this.context && this.context.state === 'suspended') this.context.resume();
    }

    createNoise() {
        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;
        return source;
    }

    createWind() {
        const ctx = this.context;
        const source = this.createNoise();
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.7;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        source.connect(filter);
        filter.connect(gain);
        if (panner) {
            gain.connect(panner);
            panner.connect(this.master);
        } else {
            gain.connect(this.master);
        }
        source.start();

        this.wind = { source, filter, gain, panner };
    }

    /**
     * Per-frame update of continuous sounds
     * @param {number} deltaTime
     * @param {object} state - { lateralWind (-1..1), balance (-1..1), onRope, active }
     */
    update(deltaTime, state) {
        if (!this.context || this.context.state !== 'running') return;
        const now = this.context.currentTime;
        const strength = Math.min(1, Math.abs(state.lateralWind));

        // Wind: louder and brighter as it picks up, panned to where it comes from
        const windLevel = state.active ? 0.04 + strength * 0.35 : 0.03;
        this.wind.gain.gain.setTargetAtTime(windLevel, now, 0.3);
        this.wind.filter.frequency.setTargetAtTime(250 + strength * 1100, now, 0.4);
        if (this.wind.panner) {
            this.wind.panner.pan.setTargetAtTime(-Math.sign(state.lateralWind) * strength * 0.7, now, 0.4);
        }

        // Heartbeat speeds up as the walker gets close to falling
        const danger = Math.abs(state.balance);
        if (state.onRope && danger > 0.55) {
            const interval = 0.95 - (danger - 0.55) / 0.45 * 0.55;
            this.heartbeatTimer -= deltaTime;
            if (this.heartbeatTimer <= 0) {
                this.heartbeatTimer = interval;
                this.heartbeat(0.4 + danger * 0.5);
            }
        } else {
            this.heartbeatTimer = 0;
        }
    }

    /**
     * Simple percussive tone
     */
    tone(frequency, duration, { type = 'sine', gain = 0.3, delay = 0, endFrequency = null } = {}) {
        if (!this.context) return;
        const ctx = this.context;
        const start = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(gain, start + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(env);
        env.connect(this.master);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    /**
     * Filtered noise burst
     */
    noiseBurst(duration, { type = 'bandpass', frequency = 1000, endFrequency = null, q = 1, gain = 0.3 } = {}) {
        if (!this.context) return;
        const ctx = this.context;
        const start = ctx.currentTime;
        const source = this.createNoise();
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.Q.value = q;
        filter.frequency.setValueAtTime(frequency, start);
        if (endFrequency) filter.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(gain, start + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        source.connect(filter);
        filter.connect(env);
        env.connect(this.master);
        source.start(start, Math.random());
        source.stop(start + duration + 0.05);
    }

    creak(strength = 0.5) {
        this.noiseBurst(0.09, { frequency: 700 + Math.random() * 400, q: 9, gain: 0.08 + strength * 0.1 });
        this.tone(170 + Math.random() * 40, 0.16, { type: 'triangle', gain: 0.035 + strength * 0.03, endFrequency: 110 });
    }

    heartbeat(intensity) {
        this.tone(58, 0.14, { gain: 0.35 * intensity, endFrequency: 40 });
        this.tone(52, 0.14, { gain: 0.25 * intensity, endFrequency: 38, delay: 0.16 });
    }

    click() {
        this.tone(660, 0.05, { type: 'triangle', gain: 0.08 });
    }

    countdown(final) {
        if (final) {
            this.tone(880, 0.35, { type: 'triangle', gain: 0.18 });
        } else {
            this.tone(520, 0.12, { type: 'triangle', gain: 0.14 });
        }
    }

    fall() {
        this.noiseBurst(1.4, { type: 'lowpass', frequency: 2400, endFrequency: 180, q: 0.8, gain: 0.35 });
    }

    success() {
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
            this.tone(frequency, 0.5, { type: 'sine', gain: 0.16, delay: i * 0.11 });
        });
    }
}

export { SoundManager };
