/**
 * gameConfig.js
 * Configuration settings for the Tightrope Walker Game
 * Centralizes game parameters for easy tuning
 */

const gameConfig = {
    // Physics settings
    physics: {
        gravity: 9.8,
        balanceThreshold: 0.8,
        balanceRecoveryRate: 0.1,
        windChangeFrequency: 3,
        maxWindForce: 0.5
    },
    
    // Character settings
    character: {
        maxSpeed: 5,
        acceleration: 1,
        deceleration: 2,
        height: 2,
        width: 0.5
    },
    
    // Environment settings
    environment: {
        ropeLength: 100,
        ropeSegments: 10,
        ropeThickness: 0.3,
        mountainDistance: 100,
        mountainHeight: 40
    },
    
    // Camera settings
    camera: {
        fov: 75,
        nearPlane: 0.1,
        farPlane: 1000,
        startPosition: { x: 0, y: 30, z: 60 },
        gameplayPosition: { x: 0, y: 5, z: 15 }
    },
    
    // Difficulty levels
    difficultyLevels: {
        easy: {
            balanceThreshold: 0.9,
            balanceRecoveryRate: 0.15,
            maxWindForce: 0.3
        },
        normal: {
            balanceThreshold: 0.8,
            balanceRecoveryRate: 0.1,
            maxWindForce: 0.5
        },
        hard: {
            balanceThreshold: 0.7,
            balanceRecoveryRate: 0.05,
            maxWindForce: 0.7
        }
    }
};

export default gameConfig; 