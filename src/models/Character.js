/**
 * Character.js
 * Manages the tightrope walker character model, animations, and state
 * Handles movement and balance controls for the character
 */

import * as THREE from 'three';

class Character {
    /**
     * Initialize the character
     * @param {THREE.Scene} scene - The Three.js scene
     * @param {THREE.Mesh} rope - The rope mesh
     * @param {Environment} environment - Reference to environment for platform positions
     */
    constructor(scene, rope, environment) {
        this.scene = scene;
        this.rope = rope;
        this.environment = environment;
        
        // Character properties
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAnimation = null;
        this.balance = 0; // -1 (left) to 1 (right)
        this.speed = 0; // Current movement speed
        this.maxSpeed = 5; // Maximum movement speed
        this.position = 0; // Position along rope (0 to 1)
        this.state = 'IDLE'; // IDLE, WALKING, BALANCING, FALLING
        this.isOnPlatform = true; // Start on platform
        this.prevState = ''; // Track previous state for animation changes
        this.prevBalance = 0; // Track previous balance for animation changes
        
        // Body parts for animation
        this.head = null;
        this.torso = null;
        this.leftArm = null;
        this.rightArm = null;
        this.leftLeg = null;
        this.rightLeg = null;
        this.balancePole = null;
        
        // Character dimensions
        this.height = 2;
        this.width = 0.5;
        
        // Movement properties
        this.acceleration = 1;
        this.deceleration = 2;
        this.balanceForce = 0; // Force applied by player (-1 to 1)
        
        // Animation timers
        this.animationClock = new THREE.Clock();
        this.walkCycle = 0;
        this.balanceCycle = 0;
    }
    
    /**
     * Load character model and animations
     * @returns {Promise} - Promise that resolves when loading is complete
     */
    async load() {
        // Create a realistic humanoid character using primitives
        this.model = new THREE.Group();
        
        // Create materials
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5d0b0,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const clothingMaterial = new THREE.MeshStandardMaterial({
            color: 0x2244aa,
            roughness: 0.8,
            metalness: 0.0
        });
        
        const shoeMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.9,
            metalness: 0.1
        });
        
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Create body parts
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        this.head = new THREE.Mesh(headGeometry, skinMaterial);
        this.head.position.y = 0.9;
        this.head.castShadow = true;
        
        // Create hair
        const hairMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a2410,
            roughness: 0.9,
            metalness: 0.0
        });
        
        const hairGeometry = new THREE.SphereGeometry(0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.rotation.x = Math.PI * 0.1;
        hair.position.y = 0.02;
        hair.position.z = -0.01;
        this.head.add(hair);
        
        // Create face features
        // Eyes
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.035, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.08, 0.05, 0.22);
        this.head.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(-0.08, 0.05, 0.22);
        this.head.add(rightEye);
        
        // Torso
        const torsoGeometry = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        this.torso = new THREE.Mesh(torsoGeometry, clothingMaterial);
        this.torso.position.y = 0.45;
        this.torso.castShadow = true;
        
        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8);
        
        this.leftArm = new THREE.Group();
        const leftArmMesh = new THREE.Mesh(armGeometry, skinMaterial);
        leftArmMesh.position.y = -0.25;
        this.leftArm.add(leftArmMesh);
        this.leftArm.position.set(0.3, 0.65, 0);
        this.leftArm.rotation.z = -0.2;
        
        this.rightArm = new THREE.Group();
        const rightArmMesh = new THREE.Mesh(armGeometry, skinMaterial);
        rightArmMesh.position.y = -0.25;
        this.rightArm.add(rightArmMesh);
        this.rightArm.position.set(-0.3, 0.65, 0);
        this.rightArm.rotation.z = 0.2;
        
        // Hands
        const handGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        
        const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
        leftHand.position.y = -0.5;
        this.leftArm.add(leftHand);
        
        const rightHand = new THREE.Mesh(handGeometry, skinMaterial);
        rightHand.position.y = -0.5;
        this.rightArm.add(rightHand);
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.09, 0.07, 0.6, 8);
        
        this.leftLeg = new THREE.Group();
        const leftLegMesh = new THREE.Mesh(legGeometry, clothingMaterial);
        leftLegMesh.position.y = -0.3;
        this.leftLeg.add(leftLegMesh);
        this.leftLeg.position.set(0.15, 0.1, 0);
        
        this.rightLeg = new THREE.Group();
        const rightLegMesh = new THREE.Mesh(legGeometry, clothingMaterial);
        rightLegMesh.position.y = -0.3;
        this.rightLeg.add(rightLegMesh);
        this.rightLeg.position.set(-0.15, 0.1, 0);
        
        // Feet
        const footGeometry = new THREE.BoxGeometry(0.12, 0.05, 0.2);
        
        const leftFoot = new THREE.Mesh(footGeometry, shoeMaterial);
        leftFoot.position.set(0, -0.6, 0.05);
        this.leftLeg.add(leftFoot);
        
        const rightFoot = new THREE.Mesh(footGeometry, shoeMaterial);
        rightFoot.position.set(0, -0.6, 0.05);
        this.rightLeg.add(rightFoot);
        
        // Balance pole
        const poleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 3, 8);
        this.balancePole = new THREE.Mesh(poleGeometry, poleMaterial);
        this.balancePole.rotation.x = Math.PI / 2;
        this.balancePole.rotation.z = Math.PI / 2;
        this.balancePole.position.y = 0.6;
        
        // Assemble character
        this.model.add(this.head);
        this.model.add(this.torso);
        this.model.add(this.leftArm);
        this.model.add(this.rightArm);
        this.model.add(this.leftLeg);
        this.model.add(this.rightLeg);
        this.model.add(this.balancePole);
        
        this.model.castShadow = true;
        
        // Position character at start platform
        this.updatePosition();
        
        this.scene.add(this.model);
        
        return Promise.resolve();
    }
    
    /**
     * Update character position based on state and position
     */
    updatePosition() {
        if (!this.model || !this.rope) return;
        
        if (this.isOnPlatform) {
            // Position character on the starting platform
            if (this.environment && this.environment.startPlatformPosition) {
                const platformPos = this.environment.startPlatformPosition;
                const platformRadius = this.environment.platformRadius;
                const platformHeight = this.environment.platformHeight;
                
                // Position near the rope edge of the platform
                this.model.position.set(
                    platformPos.x,
                    platformPos.y + platformHeight + this.height/2 - 0.6,
                    platformPos.z - platformRadius * 0.6
                );
                
                // Look towards the end platform
                if (this.environment.endPlatformPosition) {
                    const lookTarget = new THREE.Vector3().copy(this.environment.endPlatformPosition);
                    this.model.lookAt(lookTarget);
                }
                
                // Update animation
                this.playIdleAnimation();
                
                return;
            }
        }
        
        // If not on platform, position along the rope
        // Calculate position along the rope
        const curve = this.rope.geometry.parameters.path;
        const point = curve.getPointAt(this.position);
        
        // Calculate rope tangent for orientation
        const tangent = curve.getTangentAt(this.position);
        
        // Position character on rope
        this.model.position.copy(point);
        
        // Raise character to stand on top of rope
        this.model.position.y += this.height / 2 - 0.6 + this.rope.geometry.parameters.radius;
        
        // Apply balance offset (lean left/right)
        const rightVector = new THREE.Vector3(1, 0, 0);
        this.model.position.add(
            rightVector.multiplyScalar(this.balance * 0.3)
        );
        
        // Orient character along rope
        const lookAtPoint = new THREE.Vector3().copy(point).add(tangent);
        this.model.lookAt(lookAtPoint);
        
        // Apply balance to rotation (tilt left/right)
        this.model.rotation.z = this.balance * Math.PI / 8; // Tilt up to 22.5 degrees
        
        // Update animations based on character state
        this.updateAnimations();
    }
    
    /**
     * Update character animations based on state and balance
     */
    updateAnimations() {
        const stateChanged = this.prevState !== this.state;
        const balanceChanged = Math.abs(this.prevBalance - this.balance) > 0.2;
        
        if (stateChanged || balanceChanged) {
            switch (this.state) {
                case 'IDLE':
                    this.playIdleAnimation();
                    break;
                case 'WALKING':
                    this.playWalkingAnimation();
                    break;
                case 'BALANCING':
                    this.playBalancingAnimation();
                    break;
                case 'FALLING':
                    this.playFallingAnimation();
                    break;
            }
            
            this.prevState = this.state;
            this.prevBalance = this.balance;
        }
        
        // Continuously update animation parameters
        const deltaTime = this.animationClock.getDelta();
        
        // Update walk cycle
        if (this.state === 'WALKING') {
            this.walkCycle += deltaTime * this.speed * 3;
            
            // Move legs in walking motion
            const legAngle = Math.sin(this.walkCycle) * 0.3;
            this.leftLeg.rotation.x = legAngle;
            this.rightLeg.rotation.x = -legAngle;
            
            // Subtle arm movement during walking
            const armAngle = Math.sin(this.walkCycle) * 0.15;
            this.leftArm.rotation.x = -armAngle;
            this.rightArm.rotation.x = armAngle;
        }
        
        // Update balance animations
        if (this.state === 'WALKING' || this.state === 'BALANCING') {
            this.balanceCycle += deltaTime * 2;
            
            // Adjust arms based on balance
            const balanceAdjustment = Math.abs(this.balance) * 0.7;
            
            if (this.balance < -0.1) {
                // Leaning left - raise right arm
                this.rightArm.rotation.z = -0.8 * balanceAdjustment;
                this.leftArm.rotation.z = -0.2;
                
                // Tilt pole for counterbalance
                this.balancePole.rotation.y = -this.balance * 0.2;
            } else if (this.balance > 0.1) {
                // Leaning right - raise left arm
                this.leftArm.rotation.z = 0.8 * balanceAdjustment;
                this.rightArm.rotation.z = 0.2;
                
                // Tilt pole for counterbalance
                this.balancePole.rotation.y = -this.balance * 0.2;
            } else {
                // Centered - normal arm position with subtle movement
                const armSway = Math.sin(this.balanceCycle) * 0.05;
                this.leftArm.rotation.z = -0.2 + armSway;
                this.rightArm.rotation.z = 0.2 - armSway;
                this.balancePole.rotation.y = armSway * 2;
            }
            
            // Add subtle body sway
            const bodySway = Math.sin(this.balanceCycle * 1.5) * 0.02;
            this.head.rotation.z = bodySway;
            this.torso.rotation.z = bodySway;
        }
    }
    
    /**
     * Play idle animation
     */
    playIdleAnimation() {
        // Reset all rotations to default
        this.leftArm.rotation.set(0, 0, -0.2);
        this.rightArm.rotation.set(0, 0, 0.2);
        this.leftLeg.rotation.set(0, 0, 0);
        this.rightLeg.rotation.set(0, 0, 0);
        this.head.rotation.set(0, 0, 0);
        this.torso.rotation.set(0, 0, 0);
        this.balancePole.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    }
    
    /**
     * Play walking animation
     */
    playWalkingAnimation() {
        // Initial walk pose - rest is handled in updateAnimations
        this.leftArm.rotation.set(0, 0, -0.2);
        this.rightArm.rotation.set(0, 0, 0.2);
    }
    
    /**
     * Play balancing animation
     */
    playBalancingAnimation() {
        // Arms out for balance
        this.leftArm.rotation.set(0, 0, -0.5);
        this.rightArm.rotation.set(0, 0, 0.5);
        
        // Subtle knee bend
        this.leftLeg.rotation.x = 0.1;
        this.rightLeg.rotation.x = 0.1;
    }
    
    /**
     * Play falling animation
     */
    playFallingAnimation() {
        // Arms flailing
        const fallRotation = Math.sign(this.balance) * Math.PI / 2;
        this.leftArm.rotation.set(0.5, 0, -0.8);
        this.rightArm.rotation.set(0.5, 0, 0.8);
        
        // Legs kicking
        this.leftLeg.rotation.set(0.5, 0, 0);
        this.rightLeg.rotation.set(-0.3, 0, 0);
        
        // Panic expression - head tilted back
        this.head.rotation.set(0.3, 0, 0);
    }
    
    /**
     * Move the character forward
     */
    moveForward() {
        if (this.isOnPlatform) {
            // Start moving on the rope
            this.isOnPlatform = false;
            this.position = 0; // Start at the beginning of the rope
            this.state = 'WALKING';
            return;
        }
        
        // Accelerate when already on rope
        this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration);
        
        // Update character state
        if (this.state !== 'FALLING') {
            this.state = 'WALKING';
        }
    }
    
    /**
     * Adjust character balance
     * @param {number} direction - Direction to lean (-1 for left, 1 for right)
     */
    adjustBalance(direction) {
        // Only apply balance force if on the rope
        if (!this.isOnPlatform) {
            this.balanceForce = direction;
            
            // Immediately update arm positions for responsive feel
            if (direction < 0) {
                // Leaning left - raise right arm
                const intensity = Math.abs(direction) * 0.7;
                this.rightArm.rotation.z = -0.8 * intensity;
                this.balancePole.rotation.y = 0.3 * intensity;
            } else if (direction > 0) {
                // Leaning right - raise left arm
                const intensity = Math.abs(direction) * 0.7;
                this.leftArm.rotation.z = 0.8 * intensity;
                this.balancePole.rotation.y = -0.3 * intensity;
            }
        }
    }
    
    /**
     * Reset character position to start of rope
     */
    resetPosition() {
        this.position = 0;
        this.balance = 0;
        this.speed = 0;
        this.state = 'IDLE';
        this.balanceForce = 0;
        this.isOnPlatform = true;
        this.updatePosition();
    }
    
    /**
     * Update character state and position
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // If on platform, only update position if state changes
        if (this.isOnPlatform) {
            this.updatePosition();
            return;
        }
        
        // Apply balance force when on rope
        this.balance += this.balanceForce * deltaTime * 2;
        
        // Ensure balance stays within range [-1, 1]
        this.balance = Math.max(-1, Math.min(1, this.balance));
        
        // Update character state and animation
        this.updateState();
        
        // Handle movement based on state
        if (this.state === 'WALKING' || this.state === 'BALANCING') {
            // Move along rope
            this.position += (this.speed * deltaTime) / this.rope.geometry.parameters.path.getLength();
            
            // Clamp position between 0 and 1
            this.position = Math.max(0, Math.min(1, this.position));
            
            // Apply deceleration
            this.speed = Math.max(0, this.speed - this.deceleration * deltaTime);
            
            // Check if reached the end platform
            if (this.position >= 0.98) {
                this.isOnPlatform = true;
                // Update position to end platform
                if (this.environment && this.environment.endPlatformPosition) {
                    const platformPos = this.environment.endPlatformPosition;
                    const platformHeight = this.environment.platformHeight;
                    
                    this.model.position.set(
                        platformPos.x,
                        platformPos.y + platformHeight + this.height/2 - 0.6,
                        platformPos.z
                    );
                    
                    // Look back at start platform
                    if (this.environment.startPlatformPosition) {
                        const lookTarget = new THREE.Vector3().copy(this.environment.startPlatformPosition);
                        this.model.lookAt(lookTarget);
                    }
                    
                    this.state = 'IDLE';
                    this.speed = 0;
                    this.balance = 0;
                    this.balanceForce = 0;
                    
                    this.playIdleAnimation();
                    
                    return;
                }
            }
            
            // Update position on rope
            this.updatePosition();
        } else if (this.state === 'FALLING') {
            // Apply gravity
            this.model.position.y -= 9.8 * deltaTime * 2;
            
            // Rotate while falling
            this.model.rotation.z += deltaTime * 3 * Math.sign(this.balance);
            this.model.rotation.x += deltaTime * 2;
        }
    }
    
    /**
     * Update character state based on balance and speed
     */
    updateState() {
        // Only change state if not on platform
        if (this.isOnPlatform) return;
        
        // Already falling
        if (this.state === 'FALLING') return;
        
        // Determine state based on balance and speed
        const absBalance = Math.abs(this.balance);
        
        if (absBalance > 0.9) {
            // Too much imbalance, fall off
            this.state = 'FALLING';
        } else if (this.speed > 0.1) {
            // Moving
            this.state = 'WALKING';
        } else if (absBalance > 0.5) {
            // Not moving but struggling with balance
            this.state = 'BALANCING';
        } else {
            // Standing still with good balance
            this.state = 'IDLE';
        }
    }
}

export { Character }; 