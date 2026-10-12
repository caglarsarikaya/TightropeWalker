/**
 * Game.js
 * Main entry point for the Tightrope Walker Game
 * Responsible for initializing the game and orchestrating components
 */

import * as THREE from 'three';
import gameConfig from '../config/gameConfig.js';
import { CameraController } from './views/CameraController.js';
import { Character } from './models/Character.js';
import { Physics } from './models/Physics.js';
import { UIManager } from './views/UIManager.js';
import { GameState } from './viewmodels/GameState.js';
import { InputController } from './viewmodels/InputController.js';
import { Environment } from './models/Environment.js';

const NO_INPUT = Object.freeze({
    forward: false,
    back: false,
    left: false,
    right: false,
    rotateLeft: false,
    rotateRight: false
});

class Game {
    constructor() {
        this.scene = null;
        this.renderer = null;
        this.clock = null;

        this.gameState = null;
        this.input = null;
        this.uiManager = null;
        this.cameraController = null;
        this.character = null;
        this.physics = null;
        this.environment = null;

        this.runTime = 0;
        this.pendingEnd = null; // { delay, message } - shows the end screen after a moment

        this.gameContainer = document.getElementById('game-container');
        this._right = new THREE.Vector3();

        this.update = this.update.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
    }

    async init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.gameContainer.appendChild(this.renderer.domElement);

        const cameraConfig = gameConfig.camera;
        const camera = new THREE.PerspectiveCamera(
            cameraConfig.fov,
            window.innerWidth / window.innerHeight,
            cameraConfig.nearPlane,
            cameraConfig.farPlane
        );

        this.clock = new THREE.Clock();
        this.gameState = new GameState();
        this.input = new InputController();
        this.physics = new Physics();

        this.environment = new Environment(this.scene);
        await this.environment.load();

        this.character = new Character(this.scene, this.environment);
        await this.character.load();

        this.cameraController = new CameraController(camera, this.renderer.domElement);
        this.cameraController.setReferences(this.character, this.environment);

        this.uiManager = new UIManager(this);

        // Footsteps on the rope disturb balance and make the rope bounce
        this.character.onFootfall = speedRatio => {
            this.physics.addStepImpulse(speedRatio);
            this.environment.kickRope(0.5 + 0.5 * speedRatio);
        };
        this.character.onReachedEnd = () => {
            this.cameraController.startCelebrate();
            this.pendingEnd = { delay: 1.5, message: 'You made it across!' };
        };
        this.character.onFallComplete = () => {
            this.pendingEnd = { delay: 0, message: 'You fell!' };
        };

        this.input.onPress(code => {
            if (code === 'KeyC' && this.gameState.currentState === 'GAMEPLAY') {
                this.toggleCameraMode();
            }
        });

        window.addEventListener('resize', this.onWindowResize);

        const params = new URLSearchParams(window.location.search);
        if (params.has('debug')) {
            // Axes at the soles: they should sit exactly on the deck / rope
            this.character.model.add(new THREE.AxesHelper(0.5));

            this.fpsElement = document.createElement('div');
            this.fpsElement.style.cssText =
                'position:absolute;left:10px;top:10px;z-index:2000;color:#fff;font:14px monospace;' +
                'background:rgba(0,0,0,0.5);padding:4px 8px;border-radius:4px;pointer-events:none';
            document.body.appendChild(this.fpsElement);
        }
        if (params.has('debug') || params.has('probe')) {
            window.game = this;
        }

        this.gameState.changeState('START_SCREEN');
    }

    start() {
        this.clock.start();
        this.update();
    }

    /**
     * Begin (or restart) a run from the start platform
     */
    startRun() {
        this.reset();
        this.gameState.changeState('GAMEPLAY');
        this.cameraController.startIntro();
    }

    reset() {
        this.character.reset();
        this.physics.reset();
        this.environment.resetRope();
        this.runTime = 0;
        this.pendingEnd = null;
    }

    update() {
        requestAnimationFrame(this.update);

        // Fixed-size sub-steps: game time always matches real time, even at
        // low frame rates, while long hitches (tab switches) are capped.
        const config = gameConfig.physics;
        let remaining = Math.min(this.clock.getDelta(), config.maxFrameTime);
        while (remaining > 1e-6) {
            const step = Math.min(remaining, config.maxStepTime);
            this.step(step);
            remaining -= step;
        }

        this.environment.rebuildRopeGeometry();
        if (this.gameState.currentState === 'GAMEPLAY') {
            this.uiManager.updateGameplayUI(this.physics.balance);
        }
        this.updateFpsCounter();

        this.renderer.render(this.scene, this.cameraController.camera);
    }

    /**
     * Advance the simulation by one sub-step
     * @param {number} deltaTime - Seconds
     */
    step(deltaTime) {
        const playing = this.gameState.currentState === 'GAMEPLAY';
        const character = this.character;
        const physics = this.physics;
        const input = playing ? this.input.getState() : NO_INPUT;

        physics.updateWind(deltaTime, character.progress);

        // Balance only matters on the rope
        if (playing && character.isOnRope) {
            const lateralWind = physics.wind * character.getRight(this._right).x;
            const balanceInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
            const fell = physics.updateBalance(deltaTime, balanceInput, lateralWind, character.speedRatio);
            character.lean = physics.lean;

            if (fell) {
                character.startFall(physics.lean);
                this.cameraController.startFall();
            }
        } else if (!character.isFalling) {
            physics.lean = character.lean;
            physics.leanVelocity = 0;
        }

        // Rope first, so the walker samples this frame's rope shape
        this.environment.setFocus(character.model.position);
        this.environment.update(deltaTime, {
            wind: physics.wind,
            load: { active: character.isOnRope, t: character.progress, lean: character.lean }
        });

        character.update(deltaTime, input);
        this.cameraController.update(deltaTime);

        if (playing) {
            if (!character.hasFinished && !character.isFalling) {
                this.runTime += deltaTime;
            }

            if (this.pendingEnd) {
                this.pendingEnd.delay -= deltaTime;
                if (this.pendingEnd.delay <= 0) {
                    const message = this.pendingEnd.message;
                    this.pendingEnd = null;
                    this.gameState.changeState('END_SCREEN');
                    this.uiManager.showEndScreen(message);
                }
            }
        }
    }

    /**
     * With ?debug, show frames per second in the corner
     */
    updateFpsCounter() {
        if (!this.fpsElement) return;
        const now = performance.now();
        this.fpsFrames = (this.fpsFrames || 0) + 1;
        if (!this.fpsStart) this.fpsStart = now;
        if (now - this.fpsStart >= 500) {
            this.fpsElement.textContent = `${Math.round((this.fpsFrames * 1000) / (now - this.fpsStart))} fps`;
            this.fpsFrames = 0;
            this.fpsStart = now;
        }
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.cameraController.camera.aspect = width / height;
        this.cameraController.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Switch between automatic following and free orbit around the walker
     */
    toggleCameraMode() {
        const mode = this.cameraController.toggleOrbit();
        if (mode === 'ORBIT') {
            this.uiManager.showNotification('Camera: free orbit (drag to rotate, scroll to zoom)', 3000);
        } else {
            this.uiManager.showNotification('Camera: following', 2000);
        }
    }
}

const game = new Game();
game.init().then(() => {
    game.start();
});

export { Game };
