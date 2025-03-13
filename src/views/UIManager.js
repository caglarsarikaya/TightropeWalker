/**
 * UIManager.js
 * Manages UI elements, screens, and user interactions
 * Handles UI transitions between different game states
 * Enhanced with realistic mountain-themed UI elements
 */

class UIManager {
    /**
     * Initialize the UI manager
     * @param {Game} game - Reference to the main game object
     */
    constructor(game) {
        this.game = game;
        
        // Get UI elements
        this.startScreen = document.getElementById('start-screen');
        this.gameplayUI = document.getElementById('gameplay-ui');
        this.endScreen = document.getElementById('end-screen');
        
        this.playButton = document.getElementById('play-button');
        this.tryAgainButton = document.getElementById('try-again-button');
        this.endMessage = document.getElementById('end-message');
        this.performanceMetrics = document.getElementById('performance-metrics');
        
        this.balanceIndicator = document.getElementById('balance-indicator');
        this.balanceMarker = document.getElementById('balance-marker');
        this.windDirectionElement = document.getElementById('wind-direction');
        this.progressBar = document.getElementById('progress-bar');
        
        // Create notification container if it doesn't exist
        this.createNotificationContainer();
        
        // Notification timer
        this.notificationTimeout = null;
        
        // Initialize UI
        this.setupEventListeners();
        
        // Subscribe to game state changes
        this.game.gameState.addStateChangeListener(this.onGameStateChange.bind(this));
    }
    
    /**
     * Create the notification container for displaying messages
     */
    createNotificationContainer() {
        let notificationContainer = document.getElementById('notification-container');
        
        if (!notificationContainer) {
            // Create notification container element
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.className = 'notification-container';
            
            // Create notification element
            const notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            
            // Add to DOM
            notificationContainer.appendChild(notification);
            document.body.appendChild(notificationContainer);
            
            // Add CSS for notifications
            this.addNotificationStyles();
        }
        
        this.notificationContainer = notificationContainer;
        this.notification = document.getElementById('notification');
    }
    
    /**
     * Add CSS styles for notifications
     */
    addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notification-container {
                position: absolute;
                top: 20px;
                right: 20px;
                z-index: 1000;
                pointer-events: none;
            }
            
            .notification {
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 1.1rem;
                font-weight: 600;
                text-align: center;
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(3px);
                max-width: 300px;
            }
            
            .notification.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .controls-panel {
                position: absolute;
                top: 20px;
                right: 20px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 15px;
                border-radius: 10px;
                font-size: 0.9rem;
                z-index: 999;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(3px);
                transition: opacity 0.3s ease;
                opacity: 0;
            }
            
            .controls-panel.visible {
                opacity: 1;
            }
            
            .controls-panel h3 {
                margin: 0 0 10px 0;
                font-size: 1rem;
                text-align: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.3);
                padding-bottom: 5px;
            }
            
            .controls-panel table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .controls-panel td {
                padding: 3px 5px;
            }
            
            .controls-panel .key {
                display: inline-block;
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                padding: 2px 6px;
                margin: 2px;
                font-weight: bold;
                text-align: center;
                min-width: 20px;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Show a notification message
     * @param {string} message - Message to display
     * @param {number} duration - Duration in milliseconds
     */
    showNotification(message, duration = 3000) {
        // Clear any existing timeout
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }
        
        // Set notification text
        this.notification.textContent = message;
        
        // Make notification visible
        this.notification.classList.add('visible');
        
        // Set timeout to hide notification
        this.notificationTimeout = setTimeout(() => {
            this.notification.classList.remove('visible');
        }, duration);
    }
    
    /**
     * Set up event listeners for UI elements
     */
    setupEventListeners() {
        // Start button click
        this.playButton.addEventListener('click', () => {
            this.game.gameState.changeState('GAMEPLAY');
            this.hideStartScreen();
            this.showGameplayUI();
            this.game.cameraController.animateToGameplayPosition();
        });
        
        // Try again button click
        this.tryAgainButton.addEventListener('click', () => {
            this.game.gameState.changeState('START_SCREEN');
            this.hideEndScreen();
            this.hideGameplayUI();
            this.showStartScreen();
            
            // Reset game
            this.game.character.resetPosition();
            this.game.cameraController.animateToStartPosition();
        });
    }
    
    /**
     * Handler for game state changes
     * @param {string} newState - The new game state
     * @param {string} previousState - The previous game state
     */
    onGameStateChange(newState, previousState) {
        switch (newState) {
            case 'START_SCREEN':
                this.showStartScreen();
                this.hideGameplayUI();
                this.hideEndScreen();
                break;
                
            case 'GAMEPLAY':
                this.hideStartScreen();
                this.showGameplayUI();
                this.hideEndScreen();
                
                // Reset progress bar
                if (this.progressBar) {
                    this.progressBar.style.width = '0%';
                }
                break;
                
            case 'END_SCREEN':
                this.hideStartScreen();
                this.hideGameplayUI();
                this.showEndScreen();
                break;
        }
    }
    
    /**
     * Show the start screen
     */
    showStartScreen() {
        this.startScreen.style.display = 'flex';
        
        // Add subtle animation to the start screen title
        const title = this.startScreen.querySelector('h1');
        if (title) {
            title.style.opacity = 0;
            title.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                title.style.transition = 'opacity 1s ease, transform 1s ease';
                title.style.opacity = 1;
                title.style.transform = 'translateY(0)';
            }, 100);
        }
    }
    
    /**
     * Hide the start screen
     */
    hideStartScreen() {
        this.startScreen.style.display = 'none';
    }
    
    /**
     * Show the gameplay UI
     */
    showGameplayUI() {
        this.gameplayUI.style.display = 'block';
        
        // Add fade-in animation to UI elements
        const uiElements = this.gameplayUI.querySelectorAll('div[id]');
        uiElements.forEach((element, index) => {
            element.style.opacity = 0;
            
            setTimeout(() => {
                element.style.transition = 'opacity 0.5s ease';
                element.style.opacity = 1;
            }, 100 * index);
        });
        
        // Display controls panel
        this.showControlsPanel();
    }
    
    /**
     * Create and show a controls panel
     */
    showControlsPanel() {
        // Check if panel already exists
        let controlsPanel = document.getElementById('controls-panel');
        
        if (!controlsPanel) {
            // Create panel
            controlsPanel = document.createElement('div');
            controlsPanel.id = 'controls-panel';
            controlsPanel.className = 'controls-panel';
            
            // Add controls information
            controlsPanel.innerHTML = `
                <h3>Controls</h3>
                <table>
                    <tr>
                        <td><span class="key">W</span> / <span class="key">↑</span></td>
                        <td>Move forward</td>
                    </tr>
                    <tr>
                        <td><span class="key">A</span> / <span class="key">←</span></td>
                        <td>Lean left</td>
                    </tr>
                    <tr>
                        <td><span class="key">D</span> / <span class="key">→</span></td>
                        <td>Lean right</td>
                    </tr>
                    <tr>
                        <td><span class="key">C</span></td>
                        <td>Toggle camera mode</td>
                    </tr>
                    <tr>
                        <td><span class="key">Left-click</span></td>
                        <td>Orbit camera</td>
                    </tr>
                    <tr>
                        <td><span class="key">Right-click</span></td>
                        <td>Pan camera</td>
                    </tr>
                    <tr>
                        <td><span class="key">Scroll</span></td>
                        <td>Zoom camera</td>
                    </tr>
                </table>
            `;
            
            // Add to DOM
            document.body.appendChild(controlsPanel);
        }
        
        // Make visible with slight delay
        setTimeout(() => {
            controlsPanel.classList.add('visible');
        }, 500);
    }
    
    /**
     * Hide the controls panel
     */
    hideControlsPanel() {
        const controlsPanel = document.getElementById('controls-panel');
        if (controlsPanel) {
            controlsPanel.classList.remove('visible');
        }
    }
    
    /**
     * Hide the gameplay UI
     */
    hideGameplayUI() {
        this.gameplayUI.style.display = 'none';
        this.hideControlsPanel();
    }
    
    /**
     * Show the end screen
     * @param {string} message - The message to display
     */
    showEndScreen(message = 'Journey Complete') {
        this.endScreen.style.display = 'flex';
        this.endMessage.textContent = message;
        
        // Calculate performance metrics
        const elapsedTime = Math.floor(this.game.clock.elapsedTime);
        const distance = Math.floor(this.game.character.position * 100);
        const minutes = Math.floor(elapsedTime / 60);
        const seconds = elapsedTime % 60;
        
        // Format time nicely
        const timeString = minutes > 0 
            ? `${minutes} min ${seconds} sec` 
            : `${seconds} seconds`;
        
        // Different messages based on success or failure
        if (message.includes('fell')) {
            this.performanceMetrics.innerHTML = `
                <span style="color: #e74c3c;">❌ You lost your balance!</span><br>
                Distance: ${distance}%<br>
                Time: ${timeString}
            `;
            this.endMessage.style.color = '#e74c3c';
        } else {
            this.performanceMetrics.innerHTML = `
                <span style="color: #2ecc71;">✓ Successfully crossed the rope!</span><br>
                Time: ${timeString}
            `;
            this.endMessage.style.color = '#2ecc71';
        }
        
        // Add subtle animation to the end screen elements
        const endElements = [this.endMessage, this.performanceMetrics, this.tryAgainButton];
        endElements.forEach((element, index) => {
            if (element) {
                element.style.opacity = 0;
                element.style.transform = 'translateY(20px)';
                
                setTimeout(() => {
                    element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
                    element.style.opacity = 1;
                    element.style.transform = 'translateY(0)';
                }, 300 * index);
            }
        });
    }
    
    /**
     * Hide the end screen
     */
    hideEndScreen() {
        this.endScreen.style.display = 'none';
    }
    
    /**
     * Update the gameplay UI elements
     * @param {number} balance - Current balance value (-1 to 1)
     */
    updateGameplayUI(balance) {
        // Update balance indicator
        const balancePercent = 50 + (balance * 50); // Convert to 0-100 range
        this.balanceMarker.style.left = `${balancePercent}%`;
        
        // Change color based on how close to falling
        const balanceAbs = Math.abs(balance);
        if (balanceAbs > 0.7) {
            this.balanceMarker.style.backgroundColor = '#e74c3c'; // Red
            this.balanceMarker.style.boxShadow = '0 0 8px rgba(231, 76, 60, 0.8)';
        } else if (balanceAbs > 0.4) {
            this.balanceMarker.style.backgroundColor = '#f39c12'; // Yellow/Orange
            this.balanceMarker.style.boxShadow = '0 0 8px rgba(243, 156, 18, 0.8)';
        } else {
            this.balanceMarker.style.backgroundColor = 'white';
            this.balanceMarker.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.7)';
        }
        
        // Update wind direction
        this.updateWindDirection();
        
        // Update progress bar
        this.updateProgressBar();
    }
    
    /**
     * Update the progress bar based on character position
     */
    updateProgressBar() {
        if (this.progressBar && this.game.character) {
            const progress = this.game.character.position * 100;
            this.progressBar.style.width = `${progress}%`;
            
            // Change color as progress increases
            if (progress > 80) {
                this.progressBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
            } else if (progress > 50) {
                this.progressBar.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
            } else {
                this.progressBar.style.background = 'linear-gradient(90deg, #3498db, #2980b9)';
            }
        }
    }
    
    /**
     * Update the wind direction indicator
     */
    updateWindDirection() {
        const physics = this.game.physics;
        
        if (!physics || !this.windDirectionElement) return;
        
        // No wind
        if (physics.windForce === 0) {
            this.windDirectionElement.textContent = 'None';
            this.windDirectionElement.style.color = 'white';
            return;
        }
        
        // Determine wind direction and strength
        let direction = '';
        let color = '';
        
        if (physics.windDirection > 0.2) {
            direction = 'Right';
            color = '#3498db'; // Light blue
        } else if (physics.windDirection < -0.2) {
            direction = 'Left';
            color = '#3498db'; // Light blue
        } else {
            direction = 'Mild';
            color = 'white';
        }
        
        // Add strength indicator (arrows)
        const strength = Math.abs(physics.windForce);
        let arrows = '';
        
        if (strength > 0.35) {
            arrows = physics.windDirection > 0 ? '→→→' : '←←←';
            color = '#e74c3c'; // Red
        } else if (strength > 0.15) {
            arrows = physics.windDirection > 0 ? '→→' : '←←';
            color = '#f39c12'; // Yellow/Orange
        } else {
            arrows = physics.windDirection > 0 ? '→' : '←';
        }
        
        // Display wind information
        this.windDirectionElement.innerHTML = `${direction} <span style="font-size: 22px;">${arrows}</span>`;
        this.windDirectionElement.style.color = color;
        
        // Add subtle animation for strong wind
        if (strength > 0.3) {
            this.windDirectionElement.style.animation = 'shake 0.5s infinite';
        } else {
            this.windDirectionElement.style.animation = 'none';
        }
    }
    
    /**
     * Add visual shake effect to UI elements for impact
     * @param {string} elementId - The ID of the element to shake
     * @param {number} intensity - Shake intensity (1-5)
     */
    shakeElement(elementId, intensity = 3) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Add shake class if not already present
        if (!element.classList.contains('shaking')) {
            element.classList.add('shaking');
            
            // Set custom CSS variable for intensity
            element.style.setProperty('--shake-intensity', `${intensity * 2}px`);
            
            // Remove class after animation completes
            setTimeout(() => {
                element.classList.remove('shaking');
            }, 500);
        }
    }
}

export { UIManager }; 