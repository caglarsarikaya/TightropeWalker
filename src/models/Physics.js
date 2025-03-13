/**
 * Physics.js
 * Handles balance mechanics, forces, and collision detection
 * Implements a simple physics system for the tightrope walker
 */

class Physics {
    /**
     * Initialize the physics system
     */
    constructor() {
        // Physics constants
        this.gravity = 9.8;
        this.windForce = 0;
        this.windDirection = 0; // -1 (left) to 1 (right)
        this.balanceThreshold = 0.8; // Character falls if balance exceeds this
        this.balanceRecoveryRate = 0.1; // Natural balance recovery rate
        this.windChangeFrequency = 3; // Seconds between wind changes
        this.maxWindForce = 0.5; // Maximum wind force
        
        // Wind timer
        this.windTimer = 0;
    }
    
    /**
     * Apply physics forces to the character
     * @param {Character} character - The character to apply forces to
     * @param {number} deltaTime - Time since last update in seconds
     */
    applyForces(character, deltaTime) {
        // Update wind
        this.updateWind(deltaTime);
        
        // Calculate forces based on character state
        if (character.state === 'WALKING' || character.state === 'BALANCING') {
            // Apply wind force to balance
            character.balance += this.windForce * this.windDirection * deltaTime;
            
            // Apply movement penalty to balance (faster movement = harder to balance)
            character.balance += character.speed * (character.balance > 0 ? 0.1 : -0.1) * deltaTime;
            
            // Natural balance recovery (tends toward 0)
            if (character.balance > 0) {
                character.balance -= this.balanceRecoveryRate * deltaTime;
            } else if (character.balance < 0) {
                character.balance += this.balanceRecoveryRate * deltaTime;
            }
            
            // Ensure balance stays within range [-1, 1]
            character.balance = Math.max(-1, Math.min(1, character.balance));
        }
    }
    
    /**
     * Update wind effects
     * @param {number} deltaTime - Time since last update in seconds
     */
    updateWind(deltaTime) {
        // Update wind timer
        this.windTimer += deltaTime;
        
        // Change wind randomly
        if (this.windTimer >= this.windChangeFrequency) {
            this.generateRandomWind();
            this.windTimer = 0;
        }
    }
    
    /**
     * Generate random wind effects
     */
    generateRandomWind() {
        // Random wind direction (-1 to 1)
        this.windDirection = Math.random() * 2 - 1;
        
        // Random wind force (0 to maxWindForce)
        this.windForce = Math.random() * this.maxWindForce;
    }
    
    /**
     * Check if character is balanced
     * @param {Character} character - The character to check
     * @returns {boolean} - Whether the character is balanced
     */
    checkBalance(character) {
        // If balance exceeds threshold, character falls
        if (Math.abs(character.balance) > this.balanceThreshold) {
            character.state = 'FALLING';
            return false;
        }
        
        return true;
    }
    
    /**
     * Increase difficulty over time
     * @param {number} progressFactor - Factor between 0 and 1 representing progress
     */
    increaseDifficulty(progressFactor) {
        // Increase max wind force based on progress
        this.maxWindForce = 0.5 + (progressFactor * 0.5);
        
        // Decrease balance recovery rate based on progress
        this.balanceRecoveryRate = 0.1 * (1 - progressFactor * 0.5);
    }
}

export { Physics }; 