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
import { Settings } from './viewmodels/Settings.js';
import { SoundManager } from './audio/SoundManager.js';
import { Environment } from './models/Environment.js';

const NO_INPUT = Object.freeze({
    forward: false,
    back: false,
    left: false,
    right: false,
    rotateLeft: false,
    rotateRight: false
});

const COUNTDOWN_STEP = 0.6; // Seconds per "3", "2", "1"

class Game {
    constructor() {
        this.scene = null;
        this.renderer = null;
        this.clock = null;

        this.gameState = null;
        this.input = null;
        this.settings = new Settings();
        this.sound = new SoundManager();
        this.uiManager = null;
        this.cameraController = null;
        this.character = null;
        this.physics = null;
        this.environment = null;

        // Run state
        this.phase = 'IDLE';       // IDLE | INTRO | COUNTDOWN | PLAY | ENDING
        this.phaseTime = 0;
        this.countdownValue = null;
        this.runTime = 0;
        this.ropeTime = 0;         // Seconds spent on the rope this run
        this.maxWindPercent = 0;
        this.pendingEnd = null;    // { delay, success } - shows the result after a moment

        this.gameContainer = document.getElementById('game-container');
        this._right = new THREE.Vector3();

        this.update = this.update.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
    }

    async init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
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

        this.wireCharacterEvents();

        this.input.onPress(code => {
            if (code === 'KeyC' && this.gameState.currentState === 'GAMEPLAY' && this.phase === 'PLAY') {
                this.toggleCameraMode();
            }
        });

        // Losing focus mid-run pauses instead of letting the walker fall
        window.addEventListener('blur', () => this.autoPause());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.autoPause();
        });
        window.addEventListener('resize', this.onWindowResize);

        for (const key of Object.keys(this.settings.values)) {
            this.applySetting(key);
        }
        this.settings.onChange(key => this.applySetting(key));

        this.setupDebug();

        this.gameState.changeState('START_SCREEN');
        this.uiManager.hideLoading();
    }

    wireCharacterEvents() {
        // Footsteps on the rope disturb balance, make the rope bounce and creak
        this.character.onFootfall = speedRatio => {
            this.physics.addStepImpulse(speedRatio);
            this.environment.kickRope(0.5 + 0.5 * speedRatio);
            this.sound.creak(speedRatio);
        };
        this.character.onReachedEnd = () => {
            this.phase = 'ENDING';
            this.cameraController.startCelebrate();
            this.sound.success();
            this.pendingEnd = { delay: 1.6, success: true };
        };
        this.character.onFallComplete = () => {
            this.pendingEnd = { delay: 0, success: false };
        };
    }

    setupDebug() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('debug')) {
            // Axes at the soles: they should sit exactly on the deck / rope
            this.character.model.add(new THREE.AxesHelper(0.5));

            this.fpsElement = document.createElement('div');
            this.fpsElement.style.cssText =
                'position:fixed;left:10px;bottom:10px;z-index:2000;color:#fff;font:12px monospace;' +
                'background:rgba(0,0,0,0.5);padding:4px 8px;border-radius:4px;pointer-events:none';
            document.body.appendChild(this.fpsElement);
        }
        if (params.has('debug') || params.has('probe')) {
            window.game = this;
        }
    }

    /**
     * React to a changed (or initial) setting
     */
    applySetting(key) {
        const value = this.settings.get(key);
        switch (key) {
            case 'quality': {
                const high = value !== 'low';
                this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 1.5) : 1);
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.environment.setQuality(value);
                break;
            }
            case 'cameraSensitivity':
            case 'invertY':
                this.cameraController.setControls(
                    this.settings.get('cameraSensitivity'),
                    this.settings.get('invertY')
                );
                break;
            case 'volume':
            case 'muted':
                this.sound.setVolume(this.settings.get('volume'), this.settings.get('muted'));
                break;
            case 'difficulty':
                // Takes effect on the next run, never mid-crossing
                if (this.gameState.currentState === 'START_SCREEN') this.applyDifficulty();
                break;
        }
    }

    applyDifficulty() {
        const level = gameConfig.difficultyLevels[this.settings.get('difficulty')] || {};
        this.physics.setDifficulty(level);
        this.character.maxLean = this.physics.config.maxLean;
    }

    start() {
        this.clock.start();
        this.update();
    }

    // ------------------------------------------------------------------
    // Run flow
    // ------------------------------------------------------------------

    /**
     * Begin (or restart) a run from the start platform
     */
    startRun() {
        this.sound.init();
        this.sound.resume();
        this.applyDifficulty();
        this.reset();

        if (this.gameState.currentState !== 'GAMEPLAY') {
            this.gameState.changeState('GAMEPLAY');
        }

        this.phase = 'INTRO';
        this.phaseTime = 0;
        this.countdownValue = null;
        this.cameraController.startIntro();
        this.uiManager.newRun();
    }

    reset() {
        this.character.reset();
        this.physics.reset();
        this.environment.resetRope();
        this.input.clearVirtual();
        this.runTime = 0;
        this.ropeTime = 0;
        this.maxWindPercent = 0;
        this.pendingEnd = null;
    }

    pause() {
        if (this.gameState.currentState !== 'GAMEPLAY') return;
        this.gameState.changeState('PAUSED');
        this.input.clearVirtual();
        this.sound.suspend();
    }

    resume() {
        if (this.gameState.currentState !== 'PAUSED') return;
        this.clock.getDelta(); // Don't simulate the time spent paused
        this.gameState.changeState('GAMEPLAY');
        this.sound.resume();
    }

    autoPause() {
        const running = this.phase === 'PLAY' || this.phase === 'COUNTDOWN';
        if (this.gameState.currentState === 'GAMEPLAY' && running) {
            this.pause();
        }
    }

    quitToTitle() {
        this.reset();
        this.phase = 'IDLE';
        this.gameState.changeState('START_SCREEN');
        this.cameraController.showOverview();
        this.applyDifficulty();
        this.sound.resume();
    }

    /**
     * Record the run and show the result card
     * @param {boolean} success
     */
    finishRun(success) {
        const ropeLength = this.environment.ropeLength;
        const distance = success ? ropeLength : this.character.progress * ropeLength;
        const records = this.settings.recordRun({ success, time: this.runTime, distance });

        this.gameState.changeState('END_SCREEN');
        this.uiManager.showResult({
            success,
            time: this.runTime,
            distance,
            ropeLength,
            maxWindPercent: this.maxWindPercent,
            ...records
        });
    }

    // ------------------------------------------------------------------
    // Loop
    // ------------------------------------------------------------------

    update() {
        requestAnimationFrame(this.update);

        // Fixed-size sub-steps: game time always matches real time, even at
        // low frame rates, while long hitches (tab switches) are capped.
        const config = gameConfig.physics;
        const frameTime = Math.min(this.clock.getDelta(), config.maxFrameTime);
        const state = this.gameState.currentState;

        if (state !== 'PAUSED') {
            let remaining = frameTime;
            while (remaining > 1e-6) {
                const step = Math.min(remaining, config.maxStepTime);
                this.step(step);
                remaining -= step;
            }
        }

        this.environment.rebuildRopeGeometry();

        if (state === 'GAMEPLAY') {
            this.uiManager.updateHud();
        }

        const rightX = this.character.getRight(this._right).x;
        this.sound.update(frameTime, {
            lateralWind: (this.physics.wind * rightX) / this.physics.config.maxWind,
            balance: this.physics.balance,
            onRope: this.character.isOnRope && state === 'GAMEPLAY',
            active: state === 'GAMEPLAY'
        });

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

        if (playing) this.updatePhase(deltaTime);

        const controllable = playing && this.phase === 'PLAY';
        const input = controllable ? this.input.getState() : NO_INPUT;

        physics.updateWind(deltaTime, character.progress);

        // Balance only matters on the rope
        if (playing && character.isOnRope) {
            const lateralWind = physics.wind * character.getRight(this._right).x;
            const balanceInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
            const fell = physics.updateBalance(deltaTime, balanceInput, lateralWind, character.speedRatio);
            character.lean = physics.lean;

            this.ropeTime += deltaTime;
            this.maxWindPercent = Math.max(this.maxWindPercent,
                Math.min(100, (Math.abs(lateralWind) / physics.config.maxWind) * 100));

            if (fell) {
                character.startFall(physics.lean);
                this.cameraController.startFall();
                this.sound.fall();
                this.phase = 'ENDING';
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
            if (this.phase === 'PLAY' && !character.hasFinished && !character.isFalling) {
                this.runTime += deltaTime;
            }

            if (this.pendingEnd) {
                this.pendingEnd.delay -= deltaTime;
                if (this.pendingEnd.delay <= 0) {
                    const success = this.pendingEnd.success;
                    this.pendingEnd = null;
                    this.finishRun(success);
                }
            }
        }
    }

    /**
     * Intro camera, then 3-2-1-GO, then play
     */
    updatePhase(deltaTime) {
        this.phaseTime += deltaTime;

        if (this.phase === 'INTRO' && this.phaseTime >= gameConfig.camera.introDuration) {
            this.phase = 'COUNTDOWN';
            this.phaseTime = 0;
        }

        if (this.phase === 'COUNTDOWN') {
            const index = Math.floor(this.phaseTime / COUNTDOWN_STEP);
            const value = index < 3 ? String(3 - index) : 'GO';
            if (value !== this.countdownValue) {
                this.countdownValue = value;
                this.uiManager.countdown.show(value);
                this.sound.countdown(value === 'GO');
                if (value === 'GO') {
                    this.phase = 'PLAY';
                    this.phaseTime = 0;
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
        this.uiManager.showNotification(
            mode === 'ORBIT' ? 'Free camera — drag to orbit, scroll to zoom, C to follow' : 'Camera following',
            2200
        );
    }
}

const game = new Game();
game.init().then(() => {
    game.start();
});

export { Game };
