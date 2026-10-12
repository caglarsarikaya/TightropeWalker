/**
 * Physics.js
 * Balance mechanics and wind for the tightrope walker.
 *
 * Balance is modelled as an inverted pendulum: once the walker leans, gravity
 * pulls them further over, so the player has to actively correct with A/D.
 * Lean has momentum, which makes over-correction possible.
 */

import gameConfig from '../../config/gameConfig.js';

class Physics {
    constructor(config = gameConfig.physics) {
        this.baseConfig = config;
        this.config = config;
        this.reset();
    }

    /**
     * Apply a difficulty level's overrides on top of the base config
     * @param {object} overrides - e.g. gameConfig.difficultyLevels.hard
     */
    setDifficulty(overrides = {}) {
        this.config = { ...this.baseConfig, ...overrides };
    }

    /**
     * Wind change that is about to happen, so the UI can warn the player
     * @returns {{timeLeft: number, wind: number} | null}
     */
    get upcomingGust() {
        const timeLeft = this.nextWindChange - this.windTimer;
        if (timeLeft > 1.2) return null;
        const big = Math.abs(this.upcomingWind) > 0.3 && Math.abs(this.upcomingWind - this.baseWind) > 0.2;
        return big ? { timeLeft, wind: this.upcomingWind } : null;
    }

    randomWind() {
        return (Math.random() * 2 - 1) * this.maxWindStrength;
    }

    /**
     * Reset balance and wind to a calm starting state
     */
    reset() {
        this.lean = 0;          // Lean angle in radians (+ = walker's right)
        this.leanVelocity = 0;  // rad/s
        this.smoothedInput = 0; // A/D input after ramping (-1..1)

        this.wind = 0;          // Signed wind along world +X (-maxWind..maxWind)
        this.baseWind = 0;      // Smoothed wind without gusts
        this.targetWind = 0;
        this.windTimer = 0;
        this.nextWindChange = this.config.windChangeMin;
        this.time = 0;
        this.maxWindStrength = this.config.minWind;
        this.upcomingWind = this.randomWind(); // Picked ahead of time so gusts can be forecast
    }

    /**
     * Normalized balance for the UI: -1 (falling left) to 1 (falling right)
     */
    get balance() {
        return Math.max(-1, Math.min(1, this.lean / this.config.maxLean));
    }

    /**
     * Smoothly varying wind with occasional gusts
     * @param {number} deltaTime - Seconds since last update
     * @param {number} progress - 0..1 progress along the rope, wind gets stronger
     */
    updateWind(deltaTime, progress = 0) {
        const c = this.config;
        this.time += deltaTime;
        this.windTimer += deltaTime;
        this.maxWindStrength = c.minWind + (c.maxWind - c.minWind) * progress;

        if (this.windTimer >= this.nextWindChange) {
            this.windTimer = 0;
            this.nextWindChange = c.windChangeMin + Math.random() * (c.windChangeMax - c.windChangeMin);
            this.targetWind = this.upcomingWind;
            this.upcomingWind = this.randomWind();
        }

        // Ease toward the target, frame-rate independent
        const blend = 1 - Math.exp(-c.windResponse * deltaTime);
        this.baseWind += (this.targetWind - this.baseWind) * blend;

        this.wind = this.baseWind + this.gust();
    }

    /**
     * Low-amplitude gust noise layered on top of the smoothed wind
     */
    gust() {
        const t = this.time;
        return 0.15 * this.maxWindStrength * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1.3);
    }

    /**
     * Add a sudden kick to the lean velocity (footsteps, wobbles)
     * @param {number} amount - rad/s
     */
    addImpulse(amount) {
        this.leanVelocity += amount;
    }

    /**
     * Random kick for a footstep, scaled by walking speed
     * @param {number} speedRatio - 0..1 of max rope speed
     */
    addStepImpulse(speedRatio) {
        const kick = (Math.random() * 2 - 1) * this.config.stepImpulse * (0.5 + speedRatio);
        this.addImpulse(kick);
    }

    /**
     * Integrate the lean of a walker on the rope
     * @param {number} deltaTime - Seconds since last update
     * @param {number} inputDirection - -1 (A, lean left) .. 1 (D, lean right)
     * @param {number} lateralWind - Wind component along the walker's right
     * @param {number} speedRatio - 0..1 of max rope speed
     * @returns {boolean} true if the walker has passed the point of no return
     */
    updateBalance(deltaTime, inputDirection, lateralWind, speedRatio) {
        const c = this.config;

        const inputBlend = 1 - Math.exp(-c.inputResponse * deltaTime);
        this.smoothedInput += (inputDirection - this.smoothedInput) * inputBlend;

        const inputTorque = c.inputTorque + (c.inputTorqueWalking - c.inputTorque) * speedRatio;

        const acceleration =
            c.gravityTorque * Math.sin(this.lean) +
            c.windTorque * lateralWind +
            inputTorque * this.smoothedInput -
            c.damping * this.leanVelocity;

        this.leanVelocity += acceleration * deltaTime;
        this.lean += this.leanVelocity * deltaTime;

        return Math.abs(this.lean) > c.maxLean;
    }
}

export { Physics };
