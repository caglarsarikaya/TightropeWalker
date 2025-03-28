/**
 * Game.js
 * Main entry point for the Tightrope Walker Game
 * Responsible for initializing the game and orchestrating components
 */

import * as THREE from 'three';
import { CameraController } from './views/CameraController.js';
import { Character } from './models/Character.js';
import { Physics } from './models/Physics.js';
import { UIManager } from './views/UIManager.js';
import { GameState } from './viewmodels/GameState.js';
import { Environment } from './models/Environment.js';

class Game {
    /**
     * Initialize the game instance
     */
    constructor() {
        // Three.js core components
        this.scene = null;
        this.renderer = null;
        this.clock = null;
        
        // Game components
        this.gameState = null;
        this.uiManager = null;
        this.cameraController = null;
        this.character = null;
        this.physics = null;
        this.environment = null;
        
        // Game settings
        this.gameContainer = document.getElementById('game-container');
        
        // Bind methods to this instance
        this.update = this.update.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }
    
    /**
     * Initialize all game components
     */
    async init() {
        console.log('Initializing game...');
        
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.gameContainer.appendChild(this.renderer.domElement);
        
        // Create camera
        const camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        this.cameraController = new CameraController(this.scene, camera);
        
        // Initialize game clock
        this.clock = new THREE.Clock();
        
        // Initialize game state
        this.gameState = new GameState();
        
        // Initialize UI manager
        this.uiManager = new UIManager(this);
        
        // Initialize physics engine
        this.physics = new Physics();
        
        // Initialize environment (mountains, rope, etc.)
        this.environment = new Environment(this.scene);
        await this.environment.load();
        
        // Initialize character
        this.character = new Character(this.scene, this.environment.rope, this.environment);
        await this.character.load();
        
        // Set references for camera controller
        this.cameraController.setReferences(this.character, this.environment);
        
        // Register event listeners
        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        // Set initial game state
        this.gameState.changeState('START_SCREEN');
        
        console.log('Game initialization complete');
    }
    
    /**
     * Start the game loop
     */
    start() {
        console.log('Starting game loop');
        this.update();
    }
    
    /**
     * Main game loop
     */
    update() {
        requestAnimationFrame(this.update);
        
        const deltaTime = this.clock.getDelta();
        
        // Update game based on current state
        switch (this.gameState.currentState) {
            case 'START_SCREEN':
                // Update camera for start screen
                this.cameraController.update(deltaTime);
                break;
                
            case 'GAMEPLAY':
                // Apply physics
                this.physics.applyForces(this.character, deltaTime);
                
                // Update character
                this.character.update(deltaTime);
                
                // Update environment
                this.environment.update(deltaTime);
                
                // Update camera to follow character
                this.cameraController.update(deltaTime);
                
                // Update UI
                this.uiManager.updateGameplayUI(this.character.balance);
                
                // Check for game over condition
                if (!this.physics.checkBalance(this.character)) {
                    this.gameState.changeState('END_SCREEN');
                    this.uiManager.showEndScreen('You fell!');
                }
                
                // Check for win condition - character reaches end platform and is on platform
                if (this.character.position >= 0.98 && this.character.isOnPlatform) {
                    this.gameState.changeState('END_SCREEN');
                    this.uiManager.showEndScreen('You made it across!');
                }
                break;
                
            case 'END_SCREEN':
                // Just render the scene
                break;
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.cameraController.camera);
    }
    
    /**
     * Handle window resize events
     */
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.cameraController.camera.aspect = width / height;
        this.cameraController.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    /**
     * Handle keydown events
     * @param {KeyboardEvent} event - The keydown event
     */
    handleKeyDown(event) {
        if (this.gameState.currentState !== 'GAMEPLAY') return;
        
        switch (event.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                // Check if on platform and call the appropriate function
                if (this.character.isOnPlatform) {
                    this.character.moveLeft();
                } else {
                    this.character.adjustBalance(-1);
                }
                break;
                
            case 'ArrowRight':
            case 'd':
            case 'D':
                // Check if on platform and call the appropriate function
                if (this.character.isOnPlatform) {
                    this.character.moveRight();
                } else {
                    this.character.adjustBalance(1);
                }
                break;
                
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.character.moveForward();
                break;
                
            case 'ArrowDown':
            case 's':
            case 'S':
                // Only allow backward movement on platform
                if (this.character.isOnPlatform) {
                    this.character.moveBackward();
                }
                break;
                
            case 'q':
            case 'Q':
                // Rotate character to the left (counterclockwise)
                if (this.character.isOnPlatform) {
                    this.character.rotateLeft();
                }
                break;
                
            case 'e':
            case 'E':
                // Rotate character to the right (clockwise)
                if (this.character.isOnPlatform) {
                    this.character.rotateRight();
                }
                break;
                
            case 'c':
            case 'C':
                // Toggle camera mode when 'C' is pressed
                this.toggleCameraMode();
                break;
        }
    }
    
    /**
     * Handle keyup events
     * @param {KeyboardEvent} event - The keyup event
     */
    handleKeyUp(event) {
        if (this.gameState.currentState !== 'GAMEPLAY') return;
        
        switch (event.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (this.character.isOnPlatform) {
                    this.character.stopMovingLeft();
                } else {
                    this.character.adjustBalance(0); // Reset balance adjustment
                }
                break;
                
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (this.character.isOnPlatform) {
                    this.character.stopMovingRight();
                } else {
                    this.character.adjustBalance(0); // Reset balance adjustment
                }
                break;
                
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.character.stopMoving();
                break;
                
            case 'ArrowDown':
            case 's':
            case 'S':
                if (this.character.isOnPlatform) {
                    this.character.stopMovingBackward();
                }
                break;
                
            case 'q':
            case 'Q':
                if (this.character.isOnPlatform) {
                    this.character.stopRotatingLeft();
                }
                break;
                
            case 'e':
            case 'E':
                if (this.character.isOnPlatform) {
                    this.character.stopRotatingRight();
                }
                break;
        }
    }
    
    /**
     * Toggle between automatic camera following and manual camera control
     */
    toggleCameraMode() {
        // Determine current state based on whether mouse controls are enabled
        const isCurrentlyManual = this.cameraController.enableMouseControls;
        
        if (isCurrentlyManual) {
            // Switch to automatic camera following
            this.cameraController.setMouseControlsEnabled(false);
            
            // Animate to gameplay position
            const characterPos = this.character.model.position.clone();
            const position = new THREE.Vector3(
                characterPos.x, 
                characterPos.y + 3, // Was +5, reduced to +3 for closer third-person view
                characterPos.z + 8   // Was +15, reduced to +8 for closer third-person view
            );
            const lookAt = new THREE.Vector3(
                characterPos.x,
                characterPos.y + 1, // Added +1 to look slightly higher
                characterPos.z - 10  // Was -20, changed to -10 to look closer
            );
            
            this.cameraController.animateToPosition(position, lookAt, 1.0);
            
            // Show notification
            this.uiManager.showNotification('Camera Mode: Automatic Following', 2000);
            
            // Set follow target to character for continuous following
            this.cameraController.setFollowTarget(this.character.model);
        } else {
            // Switch to manual camera control
            this.cameraController.setMouseControlsEnabled(true);
            
            // Clear follow target when in manual mode
            this.cameraController.clearFollowTarget();
            
            // Show detailed notification about camera controls
            this.uiManager.showNotification('Camera Mode: Manual Control', 2000);
            
            // Show additional instructions with slight delay
            setTimeout(() => {
                this.uiManager.showNotification('Left-click: Orbit | Right-click: Pan | Scroll: Zoom', 4000);
            }, 2500);
        }
    }
}

// Create and initialize the game
const game = new Game();
game.init().then(() => {
    game.start();
});

export { Game }; 