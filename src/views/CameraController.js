/**
 * CameraController.js
 * Third-person camera for the walker.
 *
 * Modes:
 *  - OVERVIEW:  slow orbit around both mountains (start screen)
 *  - INTRO:     eased blend from the current view into the live follow view
 *  - FOLLOW:    behind the walker; mouse drag/scroll add temporary offsets
 *               that ease back after a moment
 *  - ORBIT:     free orbit around the walker (toggle with C); offsets persist
 *  - FALL:      holds position and tracks the falling walker
 *  - CELEBRATE: slow orbit around the walker after reaching the end
 *
 * All smoothing is frame-rate independent.
 */

import * as THREE from 'three';
import gameConfig from '../../config/gameConfig.js';

const UP = new THREE.Vector3(0, 1, 0);

function damp(rate, deltaTime) {
    return 1 - Math.exp(-rate * deltaTime);
}

function angleDelta(from, to) {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
}

class CameraController {
    /**
     * @param {THREE.PerspectiveCamera} camera
     * @param {HTMLElement} domElement - Canvas that receives mouse input
     * @param {object} config - Camera config section
     */
    constructor(camera, domElement, config = gameConfig.camera) {
        this.camera = camera;
        this.domElement = domElement;
        this.config = config;

        this.character = null;
        this.environment = null;

        this.mode = 'OVERVIEW';
        this.time = 0;

        // Overview orbit
        this.overviewAngle = 0.6;
        this.overviewCenter = new THREE.Vector3(0, 45, 0);

        // Follow rig state
        this.yaw = 0;
        this.userYaw = 0;
        this.userPitch = 0;
        this.zoom = 1;
        this.lastInteraction = -Infinity;
        this.smoothedTarget = new THREE.Vector3();
        this.followPosition = new THREE.Vector3();
        this.followLookAt = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        this.followInitialized = false;

        // Intro blend
        this.intro = null;

        // Pointer drag (mouse or touch)
        this.isDragging = false;
        this.dragPointerId = null;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.sensitivity = 1;
        this.invertY = false;

        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = event => event.preventDefault();

        domElement.style.touchAction = 'none';
        domElement.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp);
        domElement.addEventListener('wheel', this.onWheel, { passive: false });
        domElement.addEventListener('contextmenu', this.onContextMenu);

        this.updateOverview(0);
    }

    setReferences(character, environment) {
        this.character = character;
        this.environment = environment;
    }

    // ------------------------------------------------------------------
    // Mode changes
    // ------------------------------------------------------------------

    showOverview() {
        this.mode = 'OVERVIEW';
        this.intro = null;
    }

    /**
     * Blend from wherever the camera is now into the follow view
     */
    startIntro(duration = this.config.introDuration) {
        this.resetOffsets();
        this.followInitialized = false;
        this.computeFollowPose(0); // Snap the rig to its target pose

        this.intro = {
            time: 0,
            duration,
            fromPosition: this.camera.position.clone(),
            fromLookAt: this.currentLookAt.clone()
        };
        this.mode = 'INTRO';
    }

    /**
     * Toggle between automatic following and free orbit
     * @returns {string} The new mode
     */
    toggleOrbit() {
        if (this.mode === 'ORBIT') {
            this.mode = 'FOLLOW';
            this.lastInteraction = this.time; // Ease back after the usual delay
        } else if (this.mode === 'FOLLOW' || this.mode === 'INTRO') {
            this.intro = null;
            this.mode = 'ORBIT';
        }
        return this.mode;
    }

    startFall() {
        this.intro = null;
        this.mode = 'FALL';
    }

    startCelebrate() {
        this.intro = null;
        this.mode = 'CELEBRATE';
    }

    resetOffsets() {
        this.userYaw = 0;
        this.userPitch = 0;
        this.zoom = 1;
    }

    // ------------------------------------------------------------------
    // Mouse input
    // ------------------------------------------------------------------

    acceptsMouse() {
        return this.mode === 'FOLLOW' || this.mode === 'ORBIT' || this.mode === 'CELEBRATE';
    }

    /**
     * @param {number} sensitivity - Drag multiplier (1 = default)
     * @param {boolean} invertY - Invert vertical drag
     */
    setControls(sensitivity, invertY) {
        this.sensitivity = sensitivity;
        this.invertY = invertY;
    }

    onPointerDown(event) {
        if (!this.acceptsMouse() || this.dragPointerId !== null) return;
        this.dragPointerId = event.pointerId;
        this.isDragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.lastInteraction = this.time;
    }

    onPointerMove(event) {
        if (!this.isDragging || event.pointerId !== this.dragPointerId) return;
        const dx = event.clientX - this.lastMouseX;
        const dy = event.clientY - this.lastMouseY;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;

        this.userYaw -= dx * 0.005 * this.sensitivity;
        this.userPitch = THREE.MathUtils.clamp(
            this.userPitch + dy * 0.004 * this.sensitivity * (this.invertY ? -1 : 1),
            -0.45 - this.config.followPitch,
            1.35 - this.config.followPitch
        );
        this.lastInteraction = this.time;
    }

    onPointerUp(event) {
        if (event.pointerId !== this.dragPointerId) return;
        this.dragPointerId = null;
        this.isDragging = false;
    }

    onWheel(event) {
        if (!this.acceptsMouse()) return;
        event.preventDefault();
        const maxZoom = this.mode === 'ORBIT' ? 12 : 3;
        this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(event.deltaY * 0.001), 0.4, maxZoom);
        this.lastInteraction = this.time;
    }

    // ------------------------------------------------------------------
    // Update
    // ------------------------------------------------------------------

    update(deltaTime) {
        this.time += deltaTime;

        switch (this.mode) {
            case 'OVERVIEW':
                this.updateOverview(deltaTime);
                return;
            case 'INTRO':
                this.updateIntro(deltaTime);
                return;
            case 'FALL':
                this.updateFall(deltaTime);
                return;
            case 'CELEBRATE':
                this.userYaw += 0.35 * deltaTime;
                break;
            case 'FOLLOW': {
                // Drag/zoom offsets drift back once the player lets go
                const idle = this.time - this.lastInteraction > this.config.offsetReturnDelay;
                if (idle && !this.isDragging) {
                    const k = Math.exp(-2 * deltaTime);
                    this.userYaw *= k;
                    this.userPitch *= k;
                    this.zoom = Math.min(this.zoom, 3);
                }
                break;
            }
        }

        this.computeFollowPose(deltaTime);
        this.applyPose(this.followPosition, this.followLookAt);
    }

    updateOverview(deltaTime) {
        this.overviewAngle += deltaTime * 0.04;
        const radius = 150;
        this.camera.position.set(
            this.overviewCenter.x + Math.sin(this.overviewAngle) * radius,
            85,
            this.overviewCenter.z + Math.cos(this.overviewAngle) * radius
        );
        // On wide screens, aim left of the mountains so they sit to the right
        // of the title text
        const shift = this.camera.aspect > 1.2 ? 38 : 0;
        this.currentLookAt.set(
            this.overviewCenter.x - Math.cos(this.overviewAngle) * shift,
            this.overviewCenter.y,
            this.overviewCenter.z + Math.sin(this.overviewAngle) * shift
        );
        this.camera.lookAt(this.currentLookAt);
    }

    updateIntro(deltaTime) {
        const intro = this.intro;
        intro.time += deltaTime;
        this.computeFollowPose(deltaTime);

        const x = Math.min(1, intro.time / intro.duration);
        const k = x * x * (3 - 2 * x);
        const position = this._v1.lerpVectors(intro.fromPosition, this.followPosition, k);
        const lookAt = this._v2.lerpVectors(intro.fromLookAt, this.followLookAt, k);
        this.applyPose(position, lookAt, k);

        if (x >= 1) {
            this.intro = null;
            this.mode = 'FOLLOW';
        }
    }

    updateFall(deltaTime) {
        const target = this._v1.copy(this.character.model.position);
        target.y += 0.8;
        this.currentLookAt.lerp(target, damp(6, deltaTime));
        this.camera.lookAt(this.currentLookAt);
    }

    /**
     * Compute where the follow rig wants the camera to be
     * @param {number} deltaTime - 0 snaps the rig without smoothing
     */
    computeFollowPose(deltaTime) {
        const character = this.character;
        const config = this.config;
        const snap = deltaTime === 0 || !this.followInitialized;

        const target = this._v1.copy(character.model.position);
        target.y += config.focusHeight;

        if (snap) {
            this.smoothedTarget.copy(target);
        } else {
            this.smoothedTarget.lerp(target, damp(10, deltaTime));
        }

        // Behind the walker, plus any user offset
        const desiredYaw = character.heading + Math.PI + this.userYaw;
        const interacting = this.isDragging || this.time - this.lastInteraction < 0.25;
        if (snap) {
            this.yaw = desiredYaw;
        } else {
            this.yaw += angleDelta(this.yaw, desiredYaw) * damp(interacting ? 20 : 3, deltaTime);
        }

        const pitch = config.followPitch + this.userPitch;
        const distance = config.followDistance * this.zoom;
        const cosPitch = Math.cos(pitch);

        this.followPosition.set(
            this.smoothedTarget.x + Math.sin(this.yaw) * cosPitch * distance,
            this.smoothedTarget.y + Math.sin(pitch) * distance,
            this.smoothedTarget.z + Math.cos(this.yaw) * cosPitch * distance
        );

        // Never dip below the deck or the ground
        const minY = this.environment.getGroundHeightNear(this.followPosition) + 0.4;
        this.followPosition.y = Math.max(this.followPosition.y, minY);

        // Look slightly ahead of the walker, further when on the rope
        const lookAhead = THREE.MathUtils.lerp(config.lookAheadPlatform, config.lookAheadRope, character.ropeBlend);
        const forward = character.getForward(this._v2);
        this.followLookAt.copy(this.smoothedTarget).addScaledVector(forward, lookAhead);
        // Aim slightly low so the walker sits above the balance gauge
        this.followLookAt.y -= config.lookDown;

        this.followInitialized = true;
    }

    /**
     * @param {THREE.Vector3} position
     * @param {THREE.Vector3} lookAt
     * @param {number} rollWeight - 0..1 how much of the lean roll to apply
     */
    applyPose(position, lookAt, rollWeight = 1) {
        this.camera.position.copy(position);
        this.currentLookAt.copy(lookAt);
        this.camera.lookAt(this.currentLookAt);

        // A touch of roll with the walker's lean sells the wobble
        if (this.character && this.character.isOnRope) {
            this.camera.rotateZ(this.character.lean * 0.12 * rollWeight);
        }
    }
}

export { CameraController };
