/**
 * Character.js
 * The tightrope walker: procedural rig, movement on the platforms and the
 * rope, and the fall sequence.
 *
 * The model's origin is at the soles of the feet, so grounding is simply
 * `model.position.y = surfaceY`. Leaning rotates the whole body around the
 * feet, which keeps them planted on the rope.
 */

import * as THREE from 'three';
import gameConfig from '../../config/gameConfig.js';

// Rig dimensions (meters)
const THIGH = 0.45;
const SHIN = 0.42;
const FOOT_HEIGHT = 0.05;
const LEG = THIGH + SHIN;
const HIP_HEIGHT = LEG + FOOT_HEIGHT;
const SHOULDER_Y = 0.53;   // Above the hips
const UPPER_ARM = 0.29;
const FOREARM = 0.28;      // Elbow to hand center

// Distance along the rope where the walker stands after stepping on/off
const ROPE_ENTRY = 0.35;
const ROPE_EXIT_MARGIN = 0.45;

const MODES = {
    PLATFORM: 'PLATFORM',
    STEP_ON: 'STEP_ON',
    ROPE: 'ROPE',
    STEP_OFF: 'STEP_OFF',
    FINISHED: 'FINISHED',
    FALLING: 'FALLING'
};

const UP = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

// Pole holding poses in spine space
const POLE_BALANCE_POSITION = new THREE.Vector3(0, SHOULDER_Y - 0.302, 0.415);
const POLE_BALANCE_QUATERNION = new THREE.Quaternion();
const POLE_CARRY_POSITION = new THREE.Vector3(-0.26, SHOULDER_Y - 0.51, 0.21);
const POLE_CARRY_QUATERNION = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, -0.1));

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

/**
 * Frame-rate independent smoothing factor
 */
function damp(rate, deltaTime) {
    return 1 - Math.exp(-rate * deltaTime);
}

/**
 * Shortest signed difference between two angles
 */
function angleDelta(from, to) {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
}

function smoothstep01(x) {
    const t = clamp(x, 0, 1);
    return t * t * (3 - 2 * t);
}

class Character {
    /**
     * @param {THREE.Scene} scene - The Three.js scene
     * @param {Environment} environment - Provides platform and rope geometry
     * @param {object} config - Character config section
     */
    constructor(scene, environment, config = gameConfig.character) {
        this.scene = scene;
        this.environment = environment;
        this.config = config;

        this.model = null;
        this.mode = MODES.PLATFORM;

        // Movement state
        this.heading = 0;                     // Yaw in radians, 0 = facing +Z
        this.yawVelocity = 0;
        this.velocity = new THREE.Vector3();  // Platform velocity (XZ)
        this.ropeDistance = 0;                // Meters along the rope
        this.ropeSpeed = 0;
        this.lean = 0;                        // Lean angle (rad), + = walker's right, set by physics on the rope
        this.maxLean = gameConfig.physics.maxLean; // Kept in sync with the difficulty by the game

        // Animation state
        this.gaitPhase = 0;
        this.gaitAmount = 0;
        this.poleBlend = 0;   // 0 = pole carried in one hand, 1 = balancing with both hands
        this.ropeBlend = 0;   // 0 = normal stance, 1 = feet in line on the rope
        this.time = 0;

        this.transition = null;
        this.fall = null;

        // Callbacks wired by the game
        this.onFootfall = null;
        this.onReachedEnd = null;
        this.onFallComplete = null;

        // Platform geometry, filled in load()
        this.startCenter = new THREE.Vector3();
        this.endCenter = new THREE.Vector3();
        this.startAnchor = new THREE.Vector3();
        this.endAnchor = new THREE.Vector3();
        this.startRopeDir = new THREE.Vector3(); // From start platform center toward the rope (XZ)
        this.endRopeDir = new THREE.Vector3();   // From end platform center toward the rope (XZ)

        // Scratch objects
        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this._lastPosition = new THREE.Vector3();
        this._qYaw = new THREE.Quaternion();
        this._qLean = new THREE.Quaternion();
        this._qPitch = new THREE.Quaternion();
        this._qPole = new THREE.Quaternion();
    }

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    async load() {
        this.buildRig();

        const env = this.environment;
        this.startCenter.copy(env.startPlatformPosition);
        this.endCenter.copy(env.endPlatformPosition);
        env.getRopeStart(this.startAnchor);
        env.getRopeEnd(this.endAnchor);
        this.startRopeDir.subVectors(this.startAnchor, this.startCenter).setY(0).normalize();
        this.endRopeDir.subVectors(this.endAnchor, this.endCenter).setY(0).normalize();

        this.scene.add(this.model);
        this.reset();
    }

    buildRig() {
        const skin = new THREE.MeshStandardMaterial({ color: 0xf5d0b0, roughness: 0.7, metalness: 0.1 });
        const shirt = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.8 });
        const trousers = new THREE.MeshStandardMaterial({ color: 0x1d2333, roughness: 0.85 });
        const shoes = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, metalness: 0.1 });
        const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.9 });
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 });

        // Root at the soles
        this.model = new THREE.Group();
        this.model.name = 'walker';

        // Hips: pivot for both legs and the spine
        this.body = new THREE.Group();
        this.body.position.y = HIP_HEIGHT;
        this.model.add(this.body);

        const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.2), trousers);
        pelvis.position.y = 0.02;
        this.body.add(pelvis);

        // Spine (torso, head, arms, pole)
        this.spine = new THREE.Group();
        this.body.add(this.spine);

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.2), shirt);
        torso.position.y = 0.32;
        this.spine.add(torso);

        this.head = new THREE.Group();
        this.head.position.y = 0.62;
        this.spine.add(this.head);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), skin);
        neck.position.y = 0.0;
        this.head.add(neck);

        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), skin);
        skull.position.y = 0.11;
        this.head.add(skull);

        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.115, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            hairMaterial
        );
        hair.position.set(0, 0.12, -0.01);
        hair.rotation.x = -0.25;
        this.head.add(hair);

        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.015, 8, 8);
        for (const side of [1, -1]) {
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(side * 0.04, 0.13, 0.1);
            this.head.add(eye);
        }

        // Arms: shoulder -> elbow -> hand. Character's left is +X.
        this.arms = {};
        for (const [name, side] of [['left', 1], ['right', -1]]) {
            const upper = new THREE.Group();
            upper.position.set(side * 0.22, SHOULDER_Y, 0);

            const upperMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, UPPER_ARM, 8), shirt);
            upperMesh.position.y = -UPPER_ARM / 2;
            upper.add(upperMesh);

            const elbow = new THREE.Group();
            elbow.position.y = -UPPER_ARM;
            upper.add(elbow);

            const forearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, FOREARM - 0.02, 8), skin);
            forearmMesh.position.y = -(FOREARM - 0.02) / 2;
            elbow.add(forearmMesh);

            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), skin);
            hand.position.y = -FOREARM;
            elbow.add(hand);

            this.spine.add(upper);
            this.arms[name] = { upper, elbow, side };
        }

        // Legs: hip -> knee -> ankle
        this.legs = {};
        for (const [name, side] of [['left', 1], ['right', -1]]) {
            const thigh = new THREE.Group();
            thigh.position.set(side * 0.1, 0, 0);

            const thighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, THIGH, 8), trousers);
            thighMesh.position.y = -THIGH / 2;
            thigh.add(thighMesh);

            const knee = new THREE.Group();
            knee.position.y = -THIGH;
            thigh.add(knee);

            const shinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.045, SHIN, 8), trousers);
            shinMesh.position.y = -SHIN / 2;
            knee.add(shinMesh);

            const foot = new THREE.Group();
            foot.position.y = -SHIN;
            knee.add(foot);

            const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, FOOT_HEIGHT, 0.24), shoes);
            footMesh.position.set(0, -FOOT_HEIGHT / 2, 0.06);
            foot.add(footMesh);

            this.body.add(thigh);
            this.legs[name] = { thigh, knee, foot, side };
        }

        // Balance pole (a group so it can be detached when falling)
        this.pole = new THREE.Group();
        const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 8), poleMaterial);
        poleMesh.rotation.z = Math.PI / 2;
        this.pole.add(poleMesh);
        for (const side of [1, -1]) {
            const weight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), poleMaterial);
            weight.position.x = side * 1.6;
            this.pole.add(weight);
        }
        this.spine.add(this.pole);

        this.model.traverse(object => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
    }

    // ------------------------------------------------------------------
    // Public state
    // ------------------------------------------------------------------

    get isOnPlatform() {
        return this.mode === MODES.PLATFORM || this.mode === MODES.FINISHED;
    }

    get isOnRope() {
        return this.mode === MODES.ROPE;
    }

    get isFalling() {
        return this.mode === MODES.FALLING;
    }

    get hasFinished() {
        return this.mode === MODES.FINISHED;
    }

    /**
     * 0..1 progress along the rope
     */
    get progress() {
        switch (this.mode) {
            case MODES.PLATFORM:
            case MODES.STEP_ON:
                return 0;
            case MODES.STEP_OFF:
            case MODES.FINISHED:
                return 1;
            default:
                return clamp(this.ropeDistance / this.environment.ropeLength, 0, 1);
        }
    }

    /**
     * 0..1 of full walking speed on the rope
     */
    /**
     * Horizontal distance (m) from the walker to the start of the rope
     */
    get distanceToRopeStart() {
        const p = this.model.position;
        return Math.hypot(p.x - this.startAnchor.x, p.z - this.startAnchor.z);
    }

    get speedRatio() {
        return clamp(Math.abs(this.ropeSpeed) / this.config.ropeWalkSpeed, 0, 1);
    }

    getForward(target = new THREE.Vector3()) {
        return target.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    }

    /**
     * The walker's right-hand direction in world space (horizontal)
     */
    getRight(target = new THREE.Vector3()) {
        return target.set(-Math.cos(this.heading), 0, Math.sin(this.heading));
    }

    // ------------------------------------------------------------------
    // Reset
    // ------------------------------------------------------------------

    reset() {
        this.mode = MODES.PLATFORM;
        this.transition = null;
        this.fall = null;

        this.velocity.set(0, 0, 0);
        this.yawVelocity = 0;
        this.ropeDistance = 0;
        this.ropeSpeed = 0;
        this.lean = 0;
        this.gaitPhase = 0;
        this.gaitAmount = 0;
        this.poleBlend = 0;
        this.ropeBlend = 0;
        this.fallCompleteSent = false;

        // Re-attach the pole if it was dropped during a fall
        if (this.pole.parent !== this.spine) {
            this.spine.add(this.pole);
        }

        // Stand behind the platform center, facing the rope
        this.model.position.copy(this.startCenter).addScaledVector(this.startRopeDir, -1.5);
        this.model.position.y = this.environment.getPlatformSurfaceY();
        this.heading = Math.atan2(this.startRopeDir.x, this.startRopeDir.z);
        this._lastPosition.copy(this.model.position);

        this.applyTransform();
        this.updatePose(0, 0, 0);
    }

    // ------------------------------------------------------------------
    // Per-frame update
    // ------------------------------------------------------------------

    /**
     * @param {number} deltaTime - Seconds since last frame
     * @param {object} input - Held actions from InputController.getState()
     */
    update(deltaTime, input) {
        this.time += deltaTime;
        this._lastPosition.copy(this.model.position);
        const previousHeading = this.heading;

        switch (this.mode) {
            case MODES.PLATFORM:
                this.updatePlatform(deltaTime, input, this.startCenter, this.startAnchor, this.startRopeDir);
                break;
            case MODES.FINISHED:
                this.updatePlatform(deltaTime, input, this.endCenter, this.endAnchor, this.endRopeDir);
                break;
            case MODES.STEP_ON:
            case MODES.STEP_OFF:
                this.updateTransition(deltaTime);
                break;
            case MODES.ROPE:
                this.updateRope(deltaTime, input);
                break;
            case MODES.FALLING:
                this.updateFall(deltaTime);
                break;
        }

        if (this.mode !== MODES.ROPE && this.mode !== MODES.FALLING) {
            // Off the rope, straighten up
            this.lean *= Math.exp(-5 * deltaTime);
        }

        // Gait is driven by real ground distance, so feet don't slide
        const moved = this._v1.subVectors(this.model.position, this._lastPosition).setY(0).length();
        const turned = Math.abs(angleDelta(previousHeading, this.heading)) * 0.3;
        const distance = this.mode === MODES.FALLING ? 0 : moved + turned;
        const speed = deltaTime > 0 ? distance / deltaTime : 0;

        this.updateBlends(deltaTime);
        this.applyTransform();
        this.updatePose(deltaTime, distance, speed);
        this.recoverFromInvalidState();
    }

    /**
     * A single NaN in the pose makes the whole model vanish; never let it stick
     */
    recoverFromInvalidState() {
        if (!Number.isFinite(this.gaitPhase) || !Number.isFinite(this.gaitAmount)) {
            this.gaitPhase = 0;
            this.gaitAmount = 0;
        }
        if (!Number.isFinite(this.lean)) {
            this.lean = 0;
        }
        const p = this.model.position;
        if (!Number.isFinite(p.x + p.y + p.z) || !Number.isFinite(this.heading)) {
            console.warn('Walker state became invalid; resetting position');
            this.reset();
        }
    }

    /**
     * Walking around on a platform with momentum and a railing
     */
    updatePlatform(deltaTime, input, center, anchor, ropeDir) {
        const c = this.config;

        // Q/E turn with a little inertia
        const turnInput = (input.rotateLeft ? 1 : 0) - (input.rotateRight ? 1 : 0);
        this.yawVelocity += (turnInput * c.turnSpeed - this.yawVelocity) * damp(12, deltaTime);
        this.heading += this.yawVelocity * deltaTime;

        const forward = this.getForward(this._v1);
        const right = this.getRight(this._v2);

        const forwardInput = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
        const strafeInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);

        const desired = new THREE.Vector3()
            .addScaledVector(forward, forwardInput * (forwardInput > 0 ? c.platformWalkSpeed : c.platformBackSpeed))
            .addScaledVector(right, strafeInput * c.platformStrafeSpeed);
        if (desired.length() > c.platformWalkSpeed) {
            desired.setLength(c.platformWalkSpeed);
        }

        // Slow, careful steps close to the drop
        const distanceToAnchor = Math.hypot(this.model.position.x - anchor.x, this.model.position.z - anchor.z);
        if (distanceToAnchor < 3) {
            desired.multiplyScalar(0.55 + 0.45 * (distanceToAnchor / 3));
        }

        this.velocity.lerp(desired, damp(c.platformAcceleration, deltaTime));
        this.model.position.addScaledVector(this.velocity, deltaTime);

        const gate = this.constrainToPlatform(center, anchor, ropeDir);
        this.model.position.y = this.environment.getPlatformSurfaceY();

        // Step onto the rope: at the gate, facing the rope, pushing forward
        if (this.mode === MODES.PLATFORM && input.forward && gate > 0.3) {
            const atEdge = Math.hypot(this.model.position.x - anchor.x, this.model.position.z - anchor.z) < 1.0;
            const facingRope = forward.dot(ropeDir) > 0.6;
            if (atEdge && facingRope) {
                this.startStepOn();
            }
        }
    }

    /**
     * Keep the walker inside the railing; the only opening is the rope gate.
     * @returns {number} 0..1 how far inside the rope gate the walker is
     */
    constrainToPlatform(center, anchor, ropeDir) {
        const radius = this.environment.platformRadius;
        const offset = this._v2.set(
            this.model.position.x - center.x,
            0,
            this.model.position.z - center.z
        );
        const distance = offset.length();

        const along = offset.dot(ropeDir);
        const lateral = Math.abs(offset.x * ropeDir.z - offset.z * ropeDir.x);
        const gate = along > 0 ? 1 - THREE.MathUtils.smoothstep(lateral, 0.35, 0.65) : 0;
        const maxDistance = radius - 0.45 + gate * 0.4;

        if (distance > maxDistance) {
            offset.divideScalar(distance);
            this.model.position.x = center.x + offset.x * maxDistance;
            this.model.position.z = center.z + offset.z * maxDistance;

            // Remove the velocity pushing into the railing
            const outward = this.velocity.dot(offset);
            if (outward > 0) {
                this.velocity.addScaledVector(offset, -outward);
            }
        }

        return gate;
    }

    startStepOn() {
        const env = this.environment;
        this.mode = MODES.STEP_ON;
        this.velocity.set(0, 0, 0);
        this.yawVelocity = 0;
        this.transition = {
            time: 0,
            duration: this.config.stepOnDuration,
            fromPosition: this.model.position.clone(),
            fromHeading: this.heading,
            // Target is evaluated live because the rope moves
            target: () => {
                const t = ROPE_ENTRY / env.ropeLength;
                const position = env.getRopePoint(t).addScaledVector(UP, env.ropeRadius);
                const tangent = env.getRopeTangent(t);
                return { position, heading: Math.atan2(tangent.x, tangent.z) };
            },
            onComplete: () => {
                this.mode = MODES.ROPE;
                this.ropeDistance = ROPE_ENTRY;
                this.ropeSpeed = this.config.ropeWalkSpeed * 0.4;
            }
        };
    }

    startStepOff() {
        const env = this.environment;
        this.mode = MODES.STEP_OFF;
        const landing = this.endAnchor.clone().addScaledVector(this.endRopeDir, -1.4);
        landing.y = env.getPlatformSurfaceY();
        const towardCenter = new THREE.Vector3().subVectors(this.endCenter, landing).setY(0).normalize();
        const landingHeading = Math.atan2(towardCenter.x, towardCenter.z);

        this.transition = {
            time: 0,
            duration: this.config.stepOffDuration,
            fromPosition: this.model.position.clone(),
            fromHeading: this.heading,
            target: () => ({ position: landing, heading: landingHeading }),
            onComplete: () => {
                this.mode = MODES.FINISHED;
                this.ropeSpeed = 0;
                if (this.onReachedEnd) this.onReachedEnd();
            }
        };
    }

    /**
     * Short scripted move between the platform and the rope
     */
    updateTransition(deltaTime) {
        const transition = this.transition;
        transition.time += deltaTime;
        const k = smoothstep01(transition.time / transition.duration);
        const target = transition.target();

        this.model.position.lerpVectors(transition.fromPosition, target.position, k);
        // A small lift as the foot steps up/down
        this.model.position.y += Math.sin(Math.PI * k) * 0.12;
        this.heading = transition.fromHeading + angleDelta(transition.fromHeading, target.heading) * k;

        if (transition.time >= transition.duration) {
            this.model.position.copy(target.position);
            this.heading = target.heading;
            this.transition = null;
            transition.onComplete();
        }
    }

    /**
     * Walking along the rope. Balance itself is handled by Physics.
     */
    updateRope(deltaTime, input) {
        const c = this.config;
        const env = this.environment;

        // Struggling for balance slows you down
        const balanceFactor = 1 - 0.6 * clamp(Math.abs(this.lean) / this.maxLean, 0, 1);
        let targetSpeed = 0;
        if (input.forward) targetSpeed = c.ropeWalkSpeed * balanceFactor;
        else if (input.back) targetSpeed = -c.ropeBackSpeed;

        const speedingUp = Math.abs(targetSpeed) > Math.abs(this.ropeSpeed) &&
            Math.sign(targetSpeed) === Math.sign(this.ropeSpeed || targetSpeed);
        const rate = speedingUp ? c.ropeAcceleration : c.ropeDeceleration;
        const step = rate * deltaTime;
        if (Math.abs(targetSpeed - this.ropeSpeed) <= step) {
            this.ropeSpeed = targetSpeed;
        } else {
            this.ropeSpeed += Math.sign(targetSpeed - this.ropeSpeed) * step;
        }

        this.ropeDistance += this.ropeSpeed * deltaTime;
        if (this.ropeDistance < ROPE_ENTRY) {
            this.ropeDistance = ROPE_ENTRY;
            this.ropeSpeed = Math.max(0, this.ropeSpeed);
        }

        const t = this.ropeDistance / env.ropeLength;
        env.getRopePoint(t, this.model.position).addScaledVector(UP, env.ropeRadius);
        const tangent = env.getRopeTangent(t, this._v1);
        this.heading = Math.atan2(tangent.x, tangent.z);

        if (this.ropeDistance >= env.ropeLength - ROPE_EXIT_MARGIN) {
            this.startStepOff();
        }
    }

    /**
     * Start falling off the rope
     * @param {number} direction - Sign of the lean (+1 right, -1 left)
     */
    startFall(direction) {
        if (this.mode === MODES.FALLING) return;
        const side = Math.sign(direction) || 1;

        const right = this.getRight(new THREE.Vector3());
        const forward = this.getForward(new THREE.Vector3());

        this.mode = MODES.FALLING;
        this.fall = {
            time: 0,
            side,
            velocity: new THREE.Vector3()
                .addScaledVector(right, side * 1.4)
                .addScaledVector(forward, this.ropeSpeed)
                .addScaledVector(UP, 0.6),
            leanVelocity: side * 2.0,
            pitch: 0,
            landed: false,
            poleVelocity: new THREE.Vector3()
                .addScaledVector(right, -side * 0.8)
                .addScaledVector(UP, 1.2),
            poleSpin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, side * 2.5)
        };

        // Let go of the pole: keep its world transform but move it to the scene
        this.scene.attach(this.pole);
    }

    updateFall(deltaTime) {
        const fall = this.fall;
        fall.time += deltaTime;
        const groundY = -10;

        if (!fall.landed) {
            fall.velocity.y -= 9.8 * deltaTime;
            this.model.position.addScaledVector(fall.velocity, deltaTime);

            // Tumble: keep rotating over toward the side of the fall
            fall.leanVelocity += fall.side * 3 * deltaTime;
            this.lean += fall.leanVelocity * deltaTime;
            fall.pitch += 0.6 * deltaTime;

            if (this.model.position.y <= groundY) {
                this.model.position.y = groundY;
                fall.landed = true;
            }
        }

        // The dropped pole falls on its own
        if (this.pole.parent === this.scene && this.pole.position.y > groundY + 0.05) {
            fall.poleVelocity.y -= 9.8 * deltaTime;
            this.pole.position.addScaledVector(fall.poleVelocity, deltaTime);
            this.pole.rotation.x += fall.poleSpin.x * deltaTime;
            this.pole.rotation.y += fall.poleSpin.y * deltaTime;
            this.pole.rotation.z += fall.poleSpin.z * deltaTime;
        }

        if (!this.fallCompleteSent && fall.time >= this.config.fallEndDelay) {
            this.fallCompleteSent = true;
            if (this.onFallComplete) this.onFallComplete();
        }
    }

    // ------------------------------------------------------------------
    // Animation
    // ------------------------------------------------------------------

    updateBlends(deltaTime) {
        let ropeTarget = 0;
        let poleTarget = 0;

        switch (this.mode) {
            case MODES.STEP_ON:
            case MODES.ROPE:
                ropeTarget = 1;
                poleTarget = 1;
                break;
            case MODES.STEP_OFF:
                poleTarget = 1;
                break;
            case MODES.PLATFORM: {
                // Take the pole in both hands when approaching the rope
                const distance = Math.hypot(
                    this.model.position.x - this.startAnchor.x,
                    this.model.position.z - this.startAnchor.z
                );
                poleTarget = 1 - THREE.MathUtils.smoothstep(distance, 2.5, 4.0);
                break;
            }
            case MODES.FALLING:
                poleTarget = this.poleBlend;
                ropeTarget = this.ropeBlend;
                break;
        }

        this.ropeBlend += (ropeTarget - this.ropeBlend) * damp(5, deltaTime);
        this.poleBlend += (poleTarget - this.poleBlend) * damp(4, deltaTime);
    }

    /**
     * Root transform: heading, then lean around the feet
     */
    applyTransform() {
        const pitch = this.fall ? this.fall.pitch : 0;
        this._qYaw.setFromAxisAngle(UP, this.heading);
        this._qLean.setFromAxisAngle(AXIS_Z, this.lean);
        this._qPitch.setFromAxisAngle(AXIS_X, pitch);
        this.model.quaternion.copy(this._qYaw).multiply(this._qLean).multiply(this._qPitch);
    }

    /**
     * Procedural walk cycle, balance reactions and falling pose
     * @param {number} deltaTime
     * @param {number} distance - Ground distance covered this frame
     * @param {number} speed - Ground speed (m/s)
     */
    updatePose(deltaTime, distance, speed) {
        const c = this.config;
        const ropeBlend = this.ropeBlend;
        const poleBlend = this.poleBlend;

        if (this.mode === MODES.FALLING) {
            this.updateFallingPose();
            return;
        }

        // --- Gait ---------------------------------------------------------
        const referenceSpeed = lerp(c.platformWalkSpeed, c.ropeWalkSpeed, ropeBlend);
        const gaitTarget = clamp(speed / referenceSpeed, 0, 1);
        this.gaitAmount += (gaitTarget - this.gaitAmount) * damp(8, deltaTime);

        const maxStride = lerp(c.platformStride, c.ropeStride, ropeBlend);
        const stride = Math.max(0.08, maxStride * this.gaitAmount);
        const previousStep = Math.floor(this.gaitPhase / Math.PI);
        this.gaitPhase += (distance / stride) * Math.PI;
        if (Math.floor(this.gaitPhase / Math.PI) !== previousStep) {
            this.handleFootfall();
        }

        const fade = THREE.MathUtils.smoothstep(this.gaitAmount, 0, 0.15);
        const halfStride = (stride / 2) * fade;
        const sin = Math.sin(this.gaitPhase);
        const cos = Math.cos(this.gaitPhase);
        // Mostly-linear foot travel while planted, softened at the turnarounds
        const wave = 0.8 * (2 / Math.PI) * Math.asin(sin) + 0.2 * sin;

        const thighAngle = Math.asin(clamp((halfStride * wave) / LEG, -0.9, 0.9));
        const baseKnee = lerp(0.04, 0.18, ropeBlend);
        const swingKnee = (1.6 * halfStride) / LEG + 0.15 * fade;

        const legState = {
            left: { thigh: -thighAngle, knee: baseKnee + swingKnee * Math.max(0, cos) },
            right: { thigh: thighAngle, knee: baseKnee + swingKnee * Math.max(0, -cos) }
        };

        const hipWidth = lerp(0.1, 0.035, ropeBlend);
        for (const name of ['left', 'right']) {
            const leg = this.legs[name];
            const state = legState[name];
            leg.thigh.position.x = leg.side * hipWidth;
            leg.thigh.rotation.x = state.thigh;
            leg.knee.rotation.x = state.knee;
            // Keep the sole parallel to the ground; turn feet out on the rope
            leg.foot.rotation.x = -(state.thigh + state.knee);
            leg.foot.rotation.y = leg.side * 0.35 * ropeBlend;
        }

        // Hip height from the planted leg: natural rise and fall, never floating
        const stance = cos >= 0 ? legState.right : legState.left;
        this.body.position.y = THIGH * Math.cos(stance.thigh) +
            SHIN * Math.cos(stance.thigh + stance.knee) + FOOT_HEIGHT;
        // Weight shifts over the planted foot on the platform
        this.body.position.x = -0.02 * cos * fade * (1 - ropeBlend);

        // --- Upper body ---------------------------------------------------
        const breathing = Math.sin(this.time * 1.8) * 0.015;
        this.spine.rotation.set(
            breathing + 0.05 * ropeBlend,
            -0.12 * wave * fade,
            -this.lean * 0.35 * poleBlend
        );

        // Head stays level and looks ahead
        this.head.rotation.set(0.08 * ropeBlend, 0.06 * wave * fade * (1 - ropeBlend), -this.lean * 0.5);

        // Arms: blend between carrying the pole and balancing with it
        const leanShift = this.lean * 0.5 * poleBlend;
        const armSwing = 1.1 * halfStride * wave;
        const left = this.arms.left;
        const right = this.arms.right;

        left.upper.rotation.set(lerp(armSwing, -0.5, poleBlend), 0, lerp(0.08, 0, poleBlend) + leanShift);
        left.elbow.rotation.set(lerp(-0.25 - 0.15 * fade, -0.9, poleBlend), 0, 0);

        right.upper.rotation.set(lerp(-0.15 - 0.3 * armSwing, -0.5, poleBlend), 0, lerp(-0.08, 0, poleBlend) + leanShift);
        right.elbow.rotation.set(lerp(-0.5, -0.9, poleBlend), 0, 0);

        // Pole: carried along the body, or held across and counter-tilted
        this.pole.position.lerpVectors(POLE_CARRY_POSITION, POLE_BALANCE_POSITION, poleBlend);
        this.pole.position.x += Math.sin(leanShift) * 0.3;
        this.pole.quaternion.slerpQuaternions(POLE_CARRY_QUATERNION, POLE_BALANCE_QUATERNION, poleBlend);
        this._qPole.setFromAxisAngle(AXIS_Z, -this.lean * 1.3 * poleBlend);
        this.pole.quaternion.premultiply(this._qPole);
    }

    updateFallingPose() {
        const t = this.fall.time;
        const flail = Math.sin(t * 12);

        this.arms.left.upper.rotation.set(-2.2 + 0.6 * flail, 0, 1.1 + 0.3 * flail);
        this.arms.right.upper.rotation.set(-2.2 - 0.6 * flail, 0, -1.1 + 0.3 * flail);
        this.arms.left.elbow.rotation.set(-0.4, 0, 0);
        this.arms.right.elbow.rotation.set(-0.4, 0, 0);

        this.legs.left.thigh.rotation.x = -0.6 + 0.5 * Math.sin(t * 9);
        this.legs.right.thigh.rotation.x = -0.2 - 0.5 * Math.sin(t * 9);
        this.legs.left.knee.rotation.x = 0.9;
        this.legs.right.knee.rotation.x = 0.5;

        this.head.rotation.set(-0.4, 0, 0);
        this.spine.rotation.set(-0.2, 0, 0);
    }

    handleFootfall() {
        if (this.mode === MODES.ROPE && this.onFootfall) {
            this.onFootfall(this.speedRatio);
        }
    }
}

export { Character, MODES as CharacterModes };
