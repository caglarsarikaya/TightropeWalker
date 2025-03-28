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
        
        // Step-based movement system for rope
        this.isMovingForward = false; // Track if forward key is being held
        this.takingStep = false; // Currently in the process of taking a step
        this.stepDistance = 0.03; // Distance to move in one step (0.03 = 3% of rope length)
        this.stepTime = 0.5; // Time in seconds to complete one step
        this.stepTimer = 0; // Timer for current step
        this.stepStartPosition = 0; // Where the step started
        this.stepTargetPosition = 0; // Where the step will end
        this.canTakeNextStep = true; // Whether we can take another step (prevents key repeats)
        
        // Balance disturbance properties
        this.movementBalanceEffect = 0.1; // How much walking affects balance
        this.windEffect = 0; // Track current wind effect (set by Game.js)
        this.balanceNoiseTimer = 0; // Timer for random balance disturbances
        this.balanceNoiseInterval = 0.5; // How often to apply random disturbances
        this.balanceNoiseMagnitude = 0.01; // Magnitude of random disturbances
        
        // Extended balance mechanics
        this.continuousWalkingTime = 0; // How long player has been walking without stopping
        this.distanceWalked = 0; // Distance walked without stopping
        this.maxBalanceDifficulty = 4; // Maximum multiplier for balance difficulty
        this.balanceRecoveryRate = 0.7; // How quickly balance recovers when stopped
        this.balanceDifficulty = 1; // Current balance difficulty multiplier
        this.totalStepsTaken = 0; // Track total steps for balance difficulty
        
        // Platform movement properties
        this.platformMovement = {
            forward: false,  // W key
            backward: false, // S key
            left: false,     // A key
            right: false,    // D key
            rotateLeft: false, // Q key
            rotateRight: false // E key
        };
        this.platformPosition = new THREE.Vector3(); // Position on platform
        this.platformSpeed = 2.0;  // Movement speed on platforms
        this.platformRotationSpeed = 2.0; // Turning speed on platforms
        this.facingDirection = 0;  // Direction in radians (0 = +Z axis)
        this.onRopeEdge = false;   // Flag for when character is at rope edge of platform
        
        // Enhanced platform movement
        this.footstepCycle = 0;    // Cycle for footstep effects
        this.lastFootstep = 0;     // Time since last footstep
        this.footstepInterval = 0.4; // Time between footsteps
        this.bodyBobHeight = 0;    // Current body bob height
        this.strideBobAmount = 0.04; // How much the body bobs while walking
        this.nearRope = false;     // If the character is near but not at the rope edge
        this.nearRopeDistance = 2.0; // Distance to be considered "near" the rope
        this.poleHoldMode = 'ONE_HAND'; // ONE_HAND or TWO_HAND
        this.lastMovementDirection = new THREE.Vector2(); // Last movement direction
        this.playerVelocity = new THREE.Vector3(); // Current velocity
        this.naturalArmSwing = true; // Whether to use natural arm swings (when not near rope)
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
        this.balancePole.castShadow = true;
        
        // Set initial pole position to one-handed carry
        this.updatePolePosition();
        
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
     * Update pole position based on current state
     */
    updatePolePosition() {
        if (!this.balancePole) return;
        
        if (this.poleHoldMode === 'ONE_HAND') {
            // Hold pole in right hand, vertically
            this.balancePole.rotation.set(0, 0, 0); // Vertical pole
            
            // Position it near the right hand
            this.balancePole.position.set(-0.4, 0.4, 0.2);
            this.balancePole.rotation.z = -Math.PI * 0.05; // Slight angle
            
            // Make it a bit shorter for carrying
            this.balancePole.scale.set(0.9, 0.9, 0.9);
        } else if (this.poleHoldMode === 'TWO_HAND') {
            // Hold pole horizontally with both hands
            this.balancePole.rotation.set(Math.PI / 2, 0, Math.PI / 2); // Horizontal pole
            this.balancePole.position.set(0, 0.6, 0.1); // Center in front
            
            // Return to full scale
            this.balancePole.scale.set(1, 1, 1);
        }
    }
    
    /**
     * Update character position based on state and position
     */
    updatePosition() {
        if (!this.model || !this.rope) return;
        
        if (this.isOnPlatform) {
            // Position character on the platform based on platformPosition
            if (this.environment) {
                if (this.platformPosition.length() === 0) {
                    // Initialize platform position if not set
                    if (this.environment.startPlatformPosition) {
                        const platformPos = this.environment.startPlatformPosition;
                        const platformRadius = this.environment.platformRadius;
                        const platformHeight = this.environment.platformHeight || 0;
                        
                        // Place character on the platform, adjusted from center
                        this.platformPosition.set(
                            platformPos.x,
                            platformPos.y + platformHeight,
                            platformPos.z - platformRadius * 0.6
                        );
                        
                        console.log("Character positioned on platform at:", this.platformPosition);
                        
                        // Look towards the end platform
                        if (this.environment.endPlatformPosition) {
                            const lookDirection = new THREE.Vector3()
                                .copy(this.environment.endPlatformPosition)
                                .sub(platformPos)
                                .normalize();
                            this.facingDirection = Math.atan2(lookDirection.x, lookDirection.z);
                        }
                    }
                }
                
                // Position model at platform position
                this.model.position.copy(this.platformPosition);
                
                // Apply body bob for realistic walking
                if (this.state === 'WALKING') {
                    // Bob height based on step cycle
                    this.bodyBobHeight = Math.abs(Math.sin(this.footstepCycle)) * this.strideBobAmount;
                } else {
                    // Gradually reduce bob when standing still
                    this.bodyBobHeight *= 0.8;
                }
                
                // Apply vertical offset to position character directly on platform surface
                // FURTHER REDUCED OFFSET TO ELIMINATE GAP BETWEEN FEET AND PLATFORM
                this.model.position.y += this.height/2 - 1.0 + this.bodyBobHeight;
                
                // Set character rotation based on facing direction
                this.model.rotation.y = this.facingDirection;
                
                // Check if near or at rope edge
                this.checkRopeProximity();
                
                return;
            }
        }
        
        // If not on platform, position along the rope (existing rope logic)
        // Calculate position along the rope
        const curve = this.rope.geometry.parameters.path;
        const point = curve.getPointAt(this.position);
        
        // Calculate rope tangent for orientation
        const tangent = curve.getTangentAt(this.position);
        
        // Position character on rope
        this.model.position.copy(point);
        
        // Raise character to stand on top of rope
        // ADJUSTED TO MATCH PLATFORM HEIGHT REDUCTION
        this.model.position.y += this.height / 2 - 1.0 + this.rope.geometry.parameters.radius;
        
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
     * Check if character is near or at the rope edge
     */
    checkRopeProximity() {
        if (!this.environment || !this.rope) return;
        
        // Get rope start point
        const ropeStartPoint = this.rope.geometry.parameters.path.getPointAt(0);
        
        // Distance to rope start
        const distanceToRopeStart = this.platformPosition.distanceTo(ropeStartPoint);
        
        // Vector to rope
        const toRope = new THREE.Vector3()
            .copy(ropeStartPoint)
            .sub(this.platformPosition)
            .normalize();
        
        // Direction character is facing (as vector)
        const facingVector = new THREE.Vector3(
            Math.sin(this.facingDirection),
            0,
            Math.cos(this.facingDirection)
        );
        
        // Dot product to check if facing rope
        const dotProduct = facingVector.dot(toRope);
        const facingRope = dotProduct > 0.5; // Reduced threshold to make facing detection more forgiving
        const angleToDegrees = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
        
        console.log("Distance to rope:", distanceToRopeStart.toFixed(2), 
                   "Angle to rope:", angleToDegrees.toFixed(1) + "°", 
                   "Facing rope:", facingRope);
        
        // Update rope proximity states
        const prevNearRope = this.nearRope;
        const prevOnRopeEdge = this.onRopeEdge;
        
        // Check if near rope (increased distance threshold significantly)
        this.nearRope = distanceToRopeStart < this.nearRopeDistance + 1.0 && facingRope;
        
        // Check if at rope edge (increased threshold significantly)
        this.onRopeEdge = distanceToRopeStart < 2.5 && facingRope;
        
        // DIRECT ROPE ENTRY: If very close to rope regardless of facing, force rope edge
        if (distanceToRopeStart < 1.0) {
            this.onRopeEdge = true;
            console.log("FORCED ROPE EDGE - very close to rope");
        }
        
        // Update pole holding mode based on proximity to rope
        if (this.onRopeEdge) {
            if (this.poleHoldMode !== 'TWO_HAND') {
                this.poleHoldMode = 'TWO_HAND';
                this.updatePolePosition();
                console.log("At rope edge - holding pole with two hands");
            }
        } else if (this.nearRope) {
            if (this.poleHoldMode !== 'TWO_HAND') {
                this.poleHoldMode = 'TWO_HAND';
                this.updatePolePosition();
                console.log("Near rope - holding pole with two hands");
            }
        } else {
            if (this.poleHoldMode !== 'ONE_HAND') {
                this.poleHoldMode = 'ONE_HAND';
                this.updatePolePosition();
                console.log("Away from rope - holding pole with one hand");
            }
        }
        
        // Handle transition when state changes
        if (prevNearRope !== this.nearRope || prevOnRopeEdge !== this.onRopeEdge) {
            // Update animations for the new state
            if (this.state === 'WALKING') {
                this.playWalkingAnimation();
            } else {
                this.playIdleAnimation();
            }
        }
        
        // If W is pressed while at rope edge, transition to rope - MORE FORGIVING CONDITIONS
        if (this.platformMovement.forward && (this.onRopeEdge || distanceToRopeStart < 2.0)) {
            // Force transition to rope if very close or facing in right general direction
            if (distanceToRopeStart < 2.5 && (angleToDegrees < 45 || distanceToRopeStart < 1.0)) {
                console.log("Initiating transition to rope - W pressed at edge");
                this.transitionToRope();
            }
        }
    }
    
    /**
     * Play idle animation - for platform or rope
     */
    playIdleAnimation() {
        if (this.isOnPlatform) {
            // Platform idle animation
            if (this.nearRope || this.onRopeEdge) {
                // Near rope - ready stance
                this.leftArm.rotation.set(0, 0, -0.3);
                this.rightArm.rotation.set(0, 0, 0.3);
                this.leftLeg.rotation.set(0.1, 0, 0);
                this.rightLeg.rotation.set(0.1, 0, 0);
                
                // Look down at rope a bit
                this.head.rotation.set(0.2, 0, 0);
            } else {
                // Regular idle stance with pole in one hand
                this.leftArm.rotation.set(0, 0, -0.2);
                this.rightArm.rotation.set(0.2, 0, 0.3); // Right arm holding pole
                this.leftLeg.rotation.set(0, 0, 0);
                this.rightLeg.rotation.set(0, 0, 0);
                this.head.rotation.set(0, 0, 0);
            }
        } else {
            // Rope idle animation - Use existing animation
            this.leftArm.rotation.set(0, 0, -0.2);
            this.rightArm.rotation.set(0, 0, 0.2);
            this.leftLeg.rotation.set(0, 0, 0);
            this.rightLeg.rotation.set(0, 0, 0);
            this.head.rotation.set(0, 0, 0);
            this.torso.rotation.set(0, 0, 0);
        }
        
        // Update pole position based on context
        this.updatePolePosition();
    }
    
    /**
     * Play walking animation - for platform or rope
     */
    playWalkingAnimation() {
        if (this.isOnPlatform) {
            if (this.nearRope || this.onRopeEdge) {
                // Careful walking near rope edge
                this.leftArm.rotation.set(0, 0, -0.3);
                this.rightArm.rotation.set(0, 0, 0.3);
                
                // Shorter steps
                this.footstepInterval = 0.6;
            } else {
                // Normal walking on platform
                this.leftArm.rotation.set(0, 0, -0.2);
                this.rightArm.rotation.set(0.2, 0, 0.3); // Adjusted for pole
                
                // Regular step interval
                this.footstepInterval = 0.4;
            }
        } else {
            // Rope walking animation - use existing rope walking
            this.leftArm.rotation.set(0, 0, -0.2);
            this.rightArm.rotation.set(0, 0, 0.2);
        }
        
        // Update pole position based on context
        this.updatePolePosition();
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
     * Start moving the character forward (called on key down)
     */
    moveForward() {
        console.log("moveForward called, isOnPlatform:", this.isOnPlatform);
        
        if (this.isOnPlatform) {
            // Platform movement
            this.platformMovement.forward = true;
            this.state = 'WALKING';
            console.log("Platform walking forward activated");
        } else {
            // Rope movement
            this.isMovingForward = true;
        }
    }
    
    /**
     * Stop moving the character forward (called on key up)
     */
    stopMoving() {
        if (this.isOnPlatform) {
            // Platform movement
            this.platformMovement.forward = false;
            
            // If no movement keys are pressed, go to idle
            if (!this.isAnyMovementKeyPressed()) {
                this.state = 'IDLE';
            }
        } else {
            // Rope movement
            this.isMovingForward = false;
            
            // If not taking a step, immediately go to balancing state
            if (!this.takingStep) {
                this.state = 'BALANCING';
            }
        }
    }
    
    /**
     * Move backward (S key pressed)
     */
    moveBackward() {
        console.log("moveBackward called, isOnPlatform:", this.isOnPlatform);
        
        if (this.isOnPlatform) {
            this.platformMovement.backward = true;
            this.state = 'WALKING';
            console.log("Platform walking backward activated");
        }
        // No backward movement on rope
    }
    
    /**
     * Stop moving backward (S key released)
     */
    stopMovingBackward() {
        if (this.isOnPlatform) {
            this.platformMovement.backward = false;
            
            // If no movement keys are pressed, go to idle
            if (!this.isAnyMovementKeyPressed()) {
                this.state = 'IDLE';
            }
        }
    }
    
    /**
     * Move left (A key pressed)
     */
    moveLeft() {
        console.log("moveLeft called, isOnPlatform:", this.isOnPlatform);
        
        if (this.isOnPlatform) {
            this.platformMovement.left = true;
            this.state = 'WALKING';
            console.log("Platform walking left activated");
        } else {
            // On rope, adjust balance
            this.adjustBalance(-1);
        }
    }
    
    /**
     * Stop moving left (A key released)
     */
    stopMovingLeft() {
        if (this.isOnPlatform) {
            this.platformMovement.left = false;
            
            // If no movement keys are pressed, go to idle
            if (!this.isAnyMovementKeyPressed()) {
                this.state = 'IDLE';
            }
        } else {
            // On rope, stop balance adjustment
            this.adjustBalance(0);
        }
    }
    
    /**
     * Move right (D key pressed)
     */
    moveRight() {
        console.log("moveRight called, isOnPlatform:", this.isOnPlatform);
        
        if (this.isOnPlatform) {
            this.platformMovement.right = true;
            this.state = 'WALKING';
            console.log("Platform walking right activated");
        } else {
            // On rope, adjust balance
            this.adjustBalance(1);
        }
    }
    
    /**
     * Stop moving right (D key released)
     */
    stopMovingRight() {
        if (this.isOnPlatform) {
            this.platformMovement.right = false;
            
            // If no movement keys are pressed, go to idle
            if (!this.isAnyMovementKeyPressed()) {
                this.state = 'IDLE';
            }
        } else {
            // On rope, stop balance adjustment
            this.adjustBalance(0);
        }
    }
    
    /**
     * Check if any movement key is currently pressed
     * @returns {boolean} True if any movement key is pressed
     */
    isAnyMovementKeyPressed() {
        return this.platformMovement.forward ||
               this.platformMovement.backward ||
               this.platformMovement.left ||
               this.platformMovement.right;
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
     * Set the current wind effect on the character
     * @param {number} windForce - Force of wind (-1 to 1)
     */
    setWindEffect(windForce) {
        this.windEffect = windForce;
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
        this.isMovingForward = false;
        this.windEffect = 0;
        
        // Reset platform movement flags
        this.platformMovement.forward = false;
        this.platformMovement.backward = false;
        this.platformMovement.left = false;
        this.platformMovement.right = false;
        
        // Reset platform position to ensure we start at the right place
        this.platformPosition = new THREE.Vector3();
        
        // Reset pole to one hand for platform movement
        this.poleHoldMode = 'ONE_HAND';
        this.updatePolePosition();
        
        this.updatePosition();
    }
    
    /**
     * Update character state and position
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // Handle platform movement if on platform
        if (this.isOnPlatform) {
            this.updatePlatformMovement(deltaTime);
            this.updatePosition();
            return;
        }
        
        // Handle step-based movement
        if (this.takingStep) {
            // Update step timer
            this.stepTimer += deltaTime;
            
            // Calculate progress (0 to 1)
            const stepProgress = Math.min(1, this.stepTimer / this.stepTime);
            
            // Use easing for smoother step motion
            const easedProgress = this.easeInOutQuad(stepProgress);
            
            // Update position along rope
            this.position = this.stepStartPosition + 
                            (this.stepTargetPosition - this.stepStartPosition) * easedProgress;
            
            // Check if step is complete
            if (stepProgress >= 1) {
                this.takingStep = false;
                
                // If still holding forward key, immediately start next step
                if (this.isMovingForward && this.position < 0.98) {
                    this.startNewStep();
                } else {
                    this.state = 'BALANCING'; // Return to balancing after step
                }
                
                // Apply additional balance disturbance at the end of a step
                if (this.totalStepsTaken > 10) {
                    // After 10 steps, add an extra wobble at the end
                    const endStepWobble = 0.03 * this.balanceDifficulty;
                    this.balance += (Math.random() - 0.5) * endStepWobble;
                }
            }
        } else {
            // Check if we should start a new step (when W is held down)
            if (this.isMovingForward && this.position < 0.98) {
                this.startNewStep();
            }
            
            // NOT stepping - help regain balance
            if (Math.abs(this.balance) > 0.1) {
                // Apply recovery force in opposite direction of current balance
                const recoveryForce = -Math.sign(this.balance) * 
                                     this.balanceRecoveryRate * deltaTime;
                this.balance += recoveryForce;
            }
            
            // Gradually reduce balance difficulty when standing still for a while
            if (!this.takingStep && this.stepTimer > 2.0) {
                this.balanceDifficulty = Math.max(1, this.balanceDifficulty - deltaTime * 0.3);
            }
            
            // Update state based on whether balancing or idle
            if (Math.abs(this.balance) > 0.3) {
                this.state = 'BALANCING';
            } else {
                this.state = 'IDLE';
            }
        }
        
        // Add periodic balance noise for more realistic balancing challenge
        this.balanceNoiseTimer += deltaTime;
        if (this.balanceNoiseTimer >= this.balanceNoiseInterval) {
            this.balanceNoiseTimer = 0;
            
            // Apply random disturbance (affected by wind and difficulty)
            const randomNoise = (Math.random() - 0.5) * 
                              this.balanceNoiseMagnitude * this.balanceDifficulty;
            
            // Wind increases noise and biases it in the wind direction
            const windNoise = this.windEffect * 
                            this.balanceNoiseMagnitude * 0.4 * this.balanceDifficulty;
            
            this.balance += randomNoise + windNoise;
        }
        
        // Apply player's balance force (inversely proportional to difficulty)
        this.balance += (this.balanceForce * deltaTime * 2) / (Math.sqrt(this.balanceDifficulty) * 0.6);
        
        // Apply direct wind effect on balance
        this.balance += this.windEffect * deltaTime * 0.3 * this.balanceDifficulty;
        
        // Ensure balance stays within range [-1, 1]
        this.balance = Math.max(-1, Math.min(1, this.balance));
        
        // Update character state based on balance
        this.updateState();
        
        // Update position visually
        this.updatePosition();
        
        // Step timer for balance recovery
        if (!this.takingStep) {
            this.stepTimer += deltaTime;
        }
        
        // Check if reached the end platform
        if (this.position >= 0.98) {
            this.transitionToEndPlatform();
        }
    }
    
    /**
     * Easing function for smoother step movement
     * @param {number} t - Progress from 0 to 1
     * @returns {number} - Eased value from 0 to 1
     */
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    /**
     * Update character state based on balance and speed
     */
    updateState() {
        // Only change state if not on platform
        if (this.isOnPlatform) return;
        
        // Already falling
        if (this.state === 'FALLING') return;
        
        // Taking a step overrides other states
        if (this.takingStep) {
            this.state = 'WALKING';
            return;
        }
        
        // Determine state based on balance
        const absBalance = Math.abs(this.balance);
        
        if (absBalance > 0.9) {
            // Too much imbalance, fall off
            this.state = 'FALLING';
        } else if (absBalance > 0.5) {
            // Not moving but struggling with balance
            this.state = 'BALANCING';
        } else {
            // Standing still with good balance
            this.state = 'IDLE';
        }
    }
    
    /**
     * Start a new step forward
     * Helper method to encapsulate step initialization logic
     */
    startNewStep() {
        this.takingStep = true;
        this.stepTimer = 0;
        this.stepStartPosition = this.position;
        this.stepTargetPosition = Math.min(1, this.position + this.stepDistance);
        
        // Set walking state immediately
        this.state = 'WALKING';
        
        // Apply balance disturbance for this step
        const stepDisturbance = this.movementBalanceEffect * this.balanceDifficulty;
        const randomDirection = (Math.random() - 0.5 + this.windEffect * 0.2);
        this.balance += stepDisturbance * randomDirection;
        
        // Increase total steps count
        this.totalStepsTaken++;
        
        // Increase difficulty based on total steps taken
        if (this.totalStepsTaken > 5) {
            // Every 5 steps makes it harder
            const targetDifficulty = 1 + Math.min(this.maxBalanceDifficulty - 1, 
                (this.totalStepsTaken / 20) * (this.maxBalanceDifficulty - 1));
            
            this.balanceDifficulty = Math.min(this.balanceDifficulty + 0.2, targetDifficulty);
        }
    }
    
    /**
     * Update movement on platform
     * @param {number} deltaTime - Time since last update
     */
    updatePlatformMovement(deltaTime) {
        if (!this.isOnPlatform) return;
        
        // For debugging: log movement flags
        console.log("Platform movement flags:", 
            "W:", this.platformMovement.forward, 
            "S:", this.platformMovement.backward, 
            "A:", this.platformMovement.left, 
            "D:", this.platformMovement.right,
            "Q:", this.platformMovement.rotateLeft,
            "E:", this.platformMovement.rotateRight);
        
        // Handle rotation first (Q and E keys)
        if (this.platformMovement.rotateLeft) {
            // Rotate counterclockwise
            this.facingDirection += this.platformRotationSpeed * deltaTime;
            
            // Update character rotation
            this.model.rotation.y = this.facingDirection;
        }
        
        if (this.platformMovement.rotateRight) {
            // Rotate clockwise
            this.facingDirection -= this.platformRotationSpeed * deltaTime;
            
            // Update character rotation
            this.model.rotation.y = this.facingDirection;
        }
        
        // Calculate movement direction based on keys pressed
        let moveX = 0;
        let moveZ = 0;
        
        // Forward/backward in the direction character is facing
        if (this.platformMovement.forward) {
            moveZ += Math.cos(this.facingDirection);
            moveX += Math.sin(this.facingDirection);
        }
        if (this.platformMovement.backward) {
            moveZ -= Math.cos(this.facingDirection);
            moveX -= Math.sin(this.facingDirection);
        }
        
        // Left/right perpendicular to facing direction
        if (this.platformMovement.left) {
            moveZ -= Math.sin(this.facingDirection);
            moveX += Math.cos(this.facingDirection);
        }
        if (this.platformMovement.right) {
            moveZ += Math.sin(this.facingDirection);
            moveX -= Math.cos(this.facingDirection);
        }
        
        // Store movement direction for animation
        if (moveX !== 0 || moveZ !== 0) {
            this.lastMovementDirection.set(moveX, moveZ).normalize();
        }
        
        // Calculate current speed
        const isMoving = moveX !== 0 || moveZ !== 0;
        const isRotating = this.platformMovement.rotateLeft || this.platformMovement.rotateRight;
        
        // Apply movement and animations
        if (isMoving) {
            // Normalize movement vector if moving diagonally
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX /= length;
            moveZ /= length;
            
            // Walking speed varies based on proximity to rope
            let currentSpeed = this.platformSpeed;
            if (this.nearRope) {
                currentSpeed *= 0.6; // Slow down near rope
            } else if (this.onRopeEdge) {
                currentSpeed *= 0.4; // Even slower at rope edge
            }
            
            // Apply movement speed
            moveX *= currentSpeed * deltaTime;
            moveZ *= currentSpeed * deltaTime;
            
            // Track velocity for animation smoothing
            this.playerVelocity.set(moveX / deltaTime, 0, moveZ / deltaTime);
            
            // Update position - apply movement regardless of keys pressed
            this.platformPosition.x += moveX;
            this.platformPosition.z += moveZ;
            console.log("Platform position updated:", this.platformPosition.x.toFixed(2), this.platformPosition.z.toFixed(2));
            
            // Keep character on platform
            this.constrainToPlatform();
            
            // Update animation state
            if (this.state !== 'WALKING') {
                this.state = 'WALKING';
                this.playWalkingAnimation();
            }
            
            // Update footstep cycle
            this.footstepCycle += deltaTime * currentSpeed * 5;
            
            // Check for footstep sounds/effects
            this.lastFootstep += deltaTime;
            if (this.lastFootstep >= this.footstepInterval) {
                this.lastFootstep = 0;
                this.createFootstepEffect();
            }
            
            // Update walking animations
            this.updateWalkingAnimations(deltaTime);
            
        } else if (isRotating) {
            // Player is rotating in place
            if (this.state !== 'WALKING') {
                // Use walking animation when rotating in place 
                this.state = 'WALKING';
                this.playWalkingAnimation();
            }
            
            // Slower animation for rotation-only
            this.footstepCycle += deltaTime * this.platformRotationSpeed * 2;
            
            // Update walking animations with slower pace
            this.updateWalkingAnimations(deltaTime);
        } else {
            // Slowing down - not moving or rotating
            this.playerVelocity.multiplyScalar(0.9);
            
            // Reset footstep timer when stopped
            this.lastFootstep = this.footstepInterval;
            
            // Change state to idle if previously walking
            if (this.state === 'WALKING') {
                this.state = 'IDLE';
                this.playIdleAnimation();
            }
        }
    }
    
    /**
     * Create footstep effect (visual or sound)
     * In a full implementation, this would play a sound and maybe create a dust particle
     */
    createFootstepEffect() {
        // Left or right foot based on cycle
        const isLeftFoot = Math.sin(this.footstepCycle) > 0;
        
        // In a full implementation, this is where you would:
        // 1. Play footstep sound
        // 2. Create footstep particle effect
        console.log(`Footstep: ${isLeftFoot ? 'Left' : 'Right'} foot${this.nearRope ? ' (careful)' : ''}`);
    }
    
    /**
     * Update walking animations
     * @param {number} deltaTime - Time since last update
     */
    updateWalkingAnimations(deltaTime) {
        // Determine movement speed for animation pacing
        const speed = this.playerVelocity.length();
        
        // Leg movements
        const legAngle = Math.sin(this.footstepCycle) * 0.4; // Increased range for more natural walking
        this.leftLeg.rotation.x = legAngle;
        this.rightLeg.rotation.x = -legAngle;
        
        // Arm swing animations
        if (this.nearRope || this.onRopeEdge || !this.naturalArmSwing) {
            // Near rope - arms prepared for balance
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
        } else {
            // Natural arm swings while walking
            // Arms swing opposite to legs
            const armAngle = -Math.sin(this.footstepCycle) * 0.3;
            this.leftArm.rotation.x = armAngle;
            
            // Right arm has reduced swing because it's holding the pole
            this.rightArm.rotation.x = armAngle * 0.3;
        }
        
        // Torso twist for natural walking
        this.torso.rotation.y = Math.sin(this.footstepCycle) * 0.05;
        
        // Head looks slightly in the direction of movement
        if (!this.nearRope && !this.onRopeEdge) {
            this.head.rotation.y = Math.sin(this.footstepCycle * 0.5) * 0.05;
        }
        
        // Special animations for strafing (A/D without W/S)
        const isStrafing = (this.platformMovement.left || this.platformMovement.right) && 
                         !(this.platformMovement.forward || this.platformMovement.backward);
                         
        if (isStrafing && this.isOnPlatform) {
            // Tilt body into the strafe
            if (this.platformMovement.left) {
                this.torso.rotation.z = Math.max(-0.15, this.torso.rotation.z - 0.02);
            } else if (this.platformMovement.right) {
                this.torso.rotation.z = Math.min(0.15, this.torso.rotation.z + 0.02);
            }
        } else {
            // Return to upright gradually
            this.torso.rotation.z *= 0.9;
        }
    }
    
    /**
     * Transition from platform to rope with appropriate animation
     */
    transitionToRope() {
        console.log("Transitioning to rope...");
        
        // Play transition animation (could be expanded)
        this.poleHoldMode = 'TWO_HAND';
        this.updatePolePosition();
        
        // Switch to rope walking
        this.isOnPlatform = false;
        this.position = 0; // Start at beginning of rope
        this.balance = 0;  // Reset balance
        this.state = 'WALKING';
        
        // Reset platform movement flags
        this.platformMovement.forward = false;
        this.platformMovement.backward = false;
        this.platformMovement.left = false;
        this.platformMovement.right = false;
        this.platformMovement.rotateLeft = false;
        this.platformMovement.rotateRight = false;
        
        // Start moving forward on rope if W is still pressed
        this.isMovingForward = true; // Start moving forward immediately
        
        // Start a step right away for immediate feedback
        this.startNewStep();
        
        // Reset animation parameters
        this.footstepCycle = 0;
        this.lastFootstep = 0;
        this.bodyBobHeight = 0;
        
        // Update position to align with rope start
        this.updatePosition();
        
        console.log("Transition complete. isOnPlatform:", this.isOnPlatform, "isMovingForward:", this.isMovingForward);
    }
    
    /**
     * Transition to end platform when reaching end of rope
     */
    transitionToEndPlatform() {
        this.isOnPlatform = true;
        
        // Position on end platform
        if (this.environment && this.environment.endPlatformPosition) {
            const platformPos = this.environment.endPlatformPosition;
            const platformRadius = this.environment.platformRadius;
            
            // Position at edge of platform near rope
            this.platformPosition.copy(platformPos);
            
            // Offset slightly from edge
            const curve = this.rope.geometry.parameters.path;
            const ropeEndPoint = curve.getPointAt(1);
            const dirToCenter = new THREE.Vector3()
                .copy(platformPos)
                .sub(ropeEndPoint)
                .normalize();
            
            this.platformPosition.add(dirToCenter.multiplyScalar(this.width));
            
            // Set facing direction toward center of platform
            this.facingDirection = Math.atan2(dirToCenter.x, dirToCenter.z);
        }
        
        // Reset rope properties
        this.position = 1;
        this.balance = 0;
        this.state = 'IDLE';
        this.balanceForce = 0;
        this.isMovingForward = false;
        this.takingStep = false;
        this.totalStepsTaken = 0;
        this.balanceDifficulty = 1;
        
        this.playIdleAnimation();
    }
    
    /**
     * Constrain character movement to platform boundaries
     * With a wider opening at the rope connection point
     */
    constrainToPlatform() {
        if (!this.environment) return;
        
        // Current platform
        let platformPos, platformRadius;
        
        if (this.environment.startPlatformPosition && this.platformPosition.distanceTo(this.environment.startPlatformPosition) < 
            this.platformPosition.distanceTo(this.environment.endPlatformPosition || new THREE.Vector3(0, 0, 0))) {
            // On start platform
            platformPos = this.environment.startPlatformPosition;
            platformRadius = this.environment.platformRadius;
        } else if (this.environment.endPlatformPosition) {
            // On end platform
            platformPos = this.environment.endPlatformPosition;
            platformRadius = this.environment.platformRadius;
        } else {
            return;
        }
        
        // Calculate distance from platform center (XZ plane only)
        const dx = this.platformPosition.x - platformPos.x;
        const dz = this.platformPosition.z - platformPos.z;
        const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
        
        // Get the rope start point
        const ropeStartPoint = this.rope.geometry.parameters.path.getPointAt(0);
        
        // Distance to rope
        const distanceToRope = this.platformPosition.distanceTo(ropeStartPoint);
        
        // If very close to the rope, allow movement regardless of platform boundaries
        if (distanceToRope < 1.5) {
            console.log("Close to rope - allowing unrestricted movement");
            
            // If W is pressed and very close to rope, attempt transition
            if (this.platformMovement.forward && distanceToRope < 1.0) {
                console.log("FORCING rope transition from constrainToPlatform");
                this.transitionToRope();
            }
            
            return; // Skip platform edge constraints
        }
        
        // If beyond platform edge, constrain
        if (distanceFromCenter > platformRadius - this.width/2) {
            // Calculate normalized direction from center
            const dirX = dx / distanceFromCenter;
            const dirZ = dz / distanceFromCenter;
            
            // Direction from platform center to rope
            const ropeDir = new THREE.Vector3()
                .subVectors(ropeStartPoint, platformPos)
                .normalize();
                
            // Calculate angle between character's direction and rope direction
            // Use dot product to find cosine of angle, then convert to degrees
            const dotProduct = dirX * ropeDir.x + dirZ * ropeDir.z;
            const angleCos = Math.max(-1, Math.min(1, dotProduct)); // Clamp to prevent floating point errors
            const angleRadians = Math.acos(angleCos);
            const angleDegrees = angleRadians * (180 / Math.PI);
            
            // If within the 30-degree opening near the rope, allow movement off platform
            // (15 degrees on either side of the rope direction - much wider than before)
            const isInRopeOpening = angleDegrees < 15; // Increased from 5 to 15 degrees
            
            // If character is trying to go beyond platform but not at rope opening, constrain
            if (!isInRopeOpening) {
                // Set position to edge of platform
                const newRadius = platformRadius - this.width/2;
                this.platformPosition.x = platformPos.x + dirX * newRadius;
                this.platformPosition.z = platformPos.z + dirZ * newRadius;
                
                console.log("Constrained to platform edge, angle to rope:", angleDegrees.toFixed(1) + "°");
            } else {
                // Character is in the rope opening
                console.log("Character in rope opening, angle to rope:", angleDegrees.toFixed(1) + "°");
                
                // If moving toward rope while in the opening, check if we should transition
                if (this.platformMovement.forward) {
                    // Vector of current movement
                    const moveVec = new THREE.Vector3(
                        Math.sin(this.facingDirection), 
                        0, 
                        Math.cos(this.facingDirection)
                    );
                    
                    // Check if moving generally toward rope
                    const movingTowardRope = moveVec.dot(ropeDir) > 0.3;
                    
                    if (movingTowardRope && distanceToRope < 3.0) {
                        console.log("Moving toward rope in platform opening - initiating transition");
                        this.transitionToRope();
                    }
                }
            }
        }
    }
    
    /**
     * Rotate the character to the left (Q key pressed)
     */
    rotateLeft() {
        console.log("rotateLeft called, isOnPlatform:", this.isOnPlatform);
        
        if (this.isOnPlatform) {
            this.platformMovement.rotateLeft = true;
        }
    }
    
    /**
     * Stop rotating left (Q key released)
     */
    stopRotatingLeft() {
        if (this.isOnPlatform) {
            this.platformMovement.rotateLeft = false;
        }
    }
    
    /**
     * Rotate the character to the right (E key pressed)
     */
    rotateRight() {
        console.log("rotateRight called, isOnPlatform:", this.isOnPlatform);
        
        if (this.isOnPlatform) {
            this.platformMovement.rotateRight = true;
        }
    }
    
    /**
     * Stop rotating right (E key released)
     */
    stopRotatingRight() {
        if (this.isOnPlatform) {
            this.platformMovement.rotateRight = false;
        }
    }
}

export { Character }; 