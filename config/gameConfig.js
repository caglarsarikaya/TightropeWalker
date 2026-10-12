/**
 * gameConfig.js
 * Configuration settings for the Tightrope Walker Game
 * Centralizes game parameters for easy tuning
 * Units are meters / seconds / radians.
 */

const gameConfig = {
    // Balance (inverted pendulum) and wind settings
    physics: {
        gravityTorque: 2.2,      // How strongly gravity tips the walker once leaning (1/s^2)
        damping: 1.2,            // Pole + body damping on lean velocity
        maxLean: 0.6,            // Lean angle (rad) at which the walker falls (~35 deg)
        inputTorque: 2.8,        // Corrective torque from A/D while standing still
        inputTorqueWalking: 2.1, // Corrective torque from A/D at full walking speed
        inputResponse: 8,        // How quickly A/D input ramps in/out (1/s)
        windTorque: 0.9,         // Lean torque per unit of lateral wind
        stepImpulse: 0.12,       // Random lean-velocity kick per footstep
        minWind: 0.25,           // Max wind strength at start of the rope
        maxWind: 0.8,            // Max wind strength at end of the rope
        windChangeMin: 3,        // Seconds between wind target changes (min)
        windChangeMax: 6,        // Seconds between wind target changes (max)
        windResponse: 0.6,       // How quickly wind eases toward its target (1/s)
        maxFrameTime: 0.25,      // Longest frame simulated (tab switches, hitches)
        maxStepTime: 1 / 60      // Simulation sub-step size
    },

    // Character settings
    character: {
        platformWalkSpeed: 3.2,
        platformBackSpeed: 1.8,
        platformStrafeSpeed: 2.2,
        platformAcceleration: 12,   // Velocity response (1/s)
        turnSpeed: 2.8,             // Q/E rotation speed (rad/s)
        ropeWalkSpeed: 2.0,
        ropeBackSpeed: 0.6,
        ropeAcceleration: 4,        // m/s^2
        ropeDeceleration: 5,        // m/s^2
        platformStride: 0.8,        // Step length at full speed (m)
        ropeStride: 0.55,
        stepOnDuration: 0.45,
        stepOffDuration: 0.6,
        fallEndDelay: 2.2           // Seconds of falling before the end screen
    },

    // Environment settings
    environment: {
        mountainDistance: 55,   // Distance of each mountain from the center (z)
        mountainHeight: 100,
        mountainRadius: 45,
        platformRadius: 8,
        platformHeight: 2,
        ropeRadius: 0.07,
        ropeSagRatio: 1 / 40,   // Static sag as a fraction of rope length
        ropeLoadDip: 0.6,       // Extra dip under the walker at mid-span (m)
        ropeSwayPerWind: 1.4,   // Lateral sway at mid-span per unit wind (m)
        windStreaks: 260
    },

    // Camera settings
    camera: {
        fov: 60,
        nearPlane: 0.1,
        farPlane: 1500,
        followDistance: 4.5,
        followPitch: 0.32,
        focusHeight: 1.2,
        lookAheadRope: 2.0,
        lookAheadPlatform: 0.6,
        introDuration: 1.6,
        offsetReturnDelay: 1.5
    }
};

export default gameConfig;
