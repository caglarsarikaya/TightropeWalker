/**
 * GameState.js
 * Manages game state transitions and state-specific logic
 * Follows the State pattern for clean state management
 */

class GameState {
    /**
     * Initialize the game state
     */
    constructor() {
        this.currentState = null;
        this.previousState = null;
        this.stateChangeListeners = [];
        
        // Define valid state transitions
        this.validTransitions = {
            'START_SCREEN': ['GAMEPLAY'],
            'GAMEPLAY': ['PAUSED', 'END_SCREEN'],
            'PAUSED': ['GAMEPLAY', 'START_SCREEN'],
            'END_SCREEN': ['START_SCREEN']
        };
    }
    
    /**
     * Change the current game state
     * @param {string} newState - The new state to transition to
     * @returns {boolean} - Whether the transition was successful
     */
    changeState(newState) {
        // Check if the transition is valid
        if (this.currentState && 
            (!this.validTransitions[this.currentState] || 
             !this.validTransitions[this.currentState].includes(newState))) {
            console.warn(`Invalid state transition: ${this.currentState} -> ${newState}`);
            return false;
        }
        
        console.log(`State transition: ${this.currentState || 'NONE'} -> ${newState}`);
        
        // Store previous state
        this.previousState = this.currentState;
        this.currentState = newState;
        
        // Notify listeners
        this.notifyStateChangeListeners();
        
        return true;
    }
    
    /**
     * Add a listener for state changes
     * @param {Function} listener - The callback function to call on state change
     */
    addStateChangeListener(listener) {
        if (typeof listener === 'function' && !this.stateChangeListeners.includes(listener)) {
            this.stateChangeListeners.push(listener);
        }
    }
    
    /**
     * Remove a state change listener
     * @param {Function} listener - The listener to remove
     */
    removeStateChangeListener(listener) {
        const index = this.stateChangeListeners.indexOf(listener);
        if (index !== -1) {
            this.stateChangeListeners.splice(index, 1);
        }
    }
    
    /**
     * Notify all listeners about a state change
     * @private
     */
    notifyStateChangeListeners() {
        for (const listener of this.stateChangeListeners) {
            listener(this.currentState, this.previousState);
        }
    }
}

export { GameState }; 