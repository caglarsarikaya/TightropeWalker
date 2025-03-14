/**
 * CameraController.js
 * Manages camera positions, movements and animations
 * Handles different camera behaviors for different game states
 * Enhanced with mouse controls for manual camera manipulation:
 * - Left-click and drag to orbit around the character
 * - Right-click and drag to pan the camera
 * - Mouse wheel to zoom in and out
 */

import * as THREE from 'three';

class CameraController {
    /**
     * Initialize the camera controller
     * @param {THREE.Scene} scene - The Three.js scene
     * @param {THREE.Camera} camera - The Three.js camera
     */
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Camera animation properties
        this.targetPosition = new THREE.Vector3();
        this.targetLookAt = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        this.isAnimating = false;
        this.animationDuration = 2.0; // seconds
        this.animationProgress = 0;
        this.currentAnimationSpeed = 0.1; // Default animation speed
        
        // Default camera positions
        this.startPosition = new THREE.Vector3(0, 50, 120);
        this.startLookAt = new THREE.Vector3(0, 0, 0);
        
        this.gameplayPosition = new THREE.Vector3(0, 10, 20);
        this.gameplayLookAt = new THREE.Vector3(0, 0, -15);
        
        this.platformFocusPosition = new THREE.Vector3(0, 8, 15);
        this.platformFocusLookAt = new THREE.Vector3(0, 0, -50);
        
        // Character reference for following
        this.character = null;
        this.environment = null;
        
        // Mouse control properties
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseSensitivity = 0.2; // Reduced from 0.5 to make camera movement less sensitive
        this.zoomSpeed = 0.5; // Reduced for smoother zooming
        this.enableMouseControls = false; // Will be enabled during gameplay
        this.orbitRadius = 15; // Reduced from 30 to position the camera closer to character
        this.orbitAngleHorizontal = 0; // Horizontal rotation angle in radians
        this.orbitAngleVertical = 0.5; // Vertical rotation angle in radians (0 = horizon, π/2 = directly above)
        this.minVerticalAngle = 0.1; // Prevent camera from going too low
        this.maxVerticalAngle = Math.PI / 2 - 0.1; // Prevent camera from going too high
        
        // Damping for smoother camera movements
        this.dampingFactor = 0.92;
        this.velocityX = 0;
        this.velocityY = 0;
        
        // Enhanced follow target properties
        this.followTarget = null;
        this.followOffset = new THREE.Vector3(0, 3, 8);
        this.followLerpFactor = 0.1; // Smoothing factor (0-1)
        this.currentTargetPosition = new THREE.Vector3();
        this.currentLookAtPosition = new THREE.Vector3();
        
        // Set initial camera position
        this.camera.position.copy(this.startPosition);
        this.currentLookAt.copy(this.startLookAt);
        this.camera.lookAt(this.currentLookAt);
        
        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onWheel = this.onWheel.bind(this);
        
        // Setup event listeners
        this.setupMouseControls();
    }
    
    /**
     * Set up mouse control event listeners
     */
    setupMouseControls() {
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('contextmenu', this.onContextMenu);
        document.addEventListener('wheel', this.onWheel);
    }
    
    /**
     * Clean up mouse control event listeners
     */
    removeMouseControls() {
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('contextmenu', this.onContextMenu);
        document.removeEventListener('wheel', this.onWheel);
    }
    
    /**
     * Handle mouse down event
     * @param {MouseEvent} event - The mouse event
     */
    onMouseDown(event) {
        if (!this.enableMouseControls) return;
        
        if (event.button === 0) { // Left mouse button
            this.isLeftMouseDown = true;
        } else if (event.button === 2) { // Right mouse button
            this.isRightMouseDown = true;
        }
        
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    
    /**
     * Handle mouse move event
     * @param {MouseEvent} event - The mouse event
     */
    onMouseMove(event) {
        if (!this.enableMouseControls) return;
        
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        
        if (this.isLeftMouseDown) {
            // Add some acceleration with damping for smoother orbiting
            this.velocityX = this.velocityX * this.dampingFactor + deltaX * 0.01;
            this.velocityY = this.velocityY * this.dampingFactor + deltaY * 0.01;
            
            // Handle camera rotation/orbit with left mouse button
            this.orbitAngleHorizontal -= this.velocityX * this.mouseSensitivity;
            this.orbitAngleVertical += this.velocityY * this.mouseSensitivity;
            
            // Clamp vertical angle to prevent going underneath or too far overhead
            this.orbitAngleVertical = Math.max(
                this.minVerticalAngle, 
                Math.min(this.maxVerticalAngle, this.orbitAngleVertical)
            );
            
            // Only update camera immediately if not animating
            if (!this.isAnimating) {
                this.updateOrbitCamera();
            }
        }
        
        if (this.isRightMouseDown) {
            // Handle camera panning with right mouse button
            // Calculate pan direction in camera's local space
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
            
            // Scale the movement by sensitivity and current distance from target
            const distanceScale = this.orbitRadius * 0.01;
            
            // Move the camera and lookAt point
            right.multiplyScalar(-deltaX * this.mouseSensitivity * distanceScale);
            up.multiplyScalar(deltaY * this.mouseSensitivity * distanceScale);
            
            this.camera.position.add(right).add(up);
            this.currentLookAt.add(right).add(up);
            
            // Update the orbit center
            this.targetLookAt.copy(this.currentLookAt);
        }
        
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    
    /**
     * Handle mouse up event
     * @param {MouseEvent} event - The mouse event
     */
    onMouseUp(event) {
        if (event.button === 0) { // Left mouse button
            this.isLeftMouseDown = false;
            
            // Keep some inertia after releasing the mouse button
            setTimeout(() => {
                this.velocityX = 0;
                this.velocityY = 0;
            }, 300);
        } else if (event.button === 2) { // Right mouse button
            this.isRightMouseDown = false;
        }
    }
    
    /**
     * Prevent context menu from showing on right-click
     * @param {MouseEvent} event - The context menu event
     */
    onContextMenu(event) {
        if (this.enableMouseControls) {
            event.preventDefault();
        }
    }
    
    /**
     * Handle mouse wheel event for zooming
     * @param {WheelEvent} event - The wheel event
     */
    onWheel(event) {
        if (!this.enableMouseControls) return;
        
        // Prevent page scrolling
        event.preventDefault();
        
        // Calculate zoom factor based on wheel delta
        const zoomAmount = event.deltaY * this.zoomSpeed * 0.01;
        this.orbitRadius += zoomAmount;
        
        // Clamp orbit radius to reasonable values
        this.orbitRadius = Math.max(5, Math.min(200, this.orbitRadius));
        
        // Only update camera immediately if not animating
        if (!this.isAnimating) {
            this.updateOrbitCamera();
        }
    }
    
    /**
     * Update camera position based on orbit parameters
     */
    updateOrbitCamera() {
        // Calculate camera position in spherical coordinates
        const sinV = Math.sin(this.orbitAngleVertical);
        const cosV = Math.cos(this.orbitAngleVertical);
        const sinH = Math.sin(this.orbitAngleHorizontal);
        const cosH = Math.cos(this.orbitAngleHorizontal);
        
        // Convert to Cartesian coordinates
        const x = this.orbitRadius * cosV * sinH;
        const y = this.orbitRadius * sinV;
        const z = this.orbitRadius * cosV * cosH;
        
        // Set camera position relative to look-at point
        this.camera.position.set(
            this.currentLookAt.x + x,
            this.currentLookAt.y + y,
            this.currentLookAt.z + z
        );
        
        // Update camera orientation
        this.camera.lookAt(this.currentLookAt);
    }
    
    /**
     * Set target for camera to follow
     * @param {THREE.Object3D} target - Object to follow
     */
    setFollowTarget(target) {
        this.followTarget = target;
        
        // Initialize current positions if target is set
        if (target) {
            const position = target.position.clone();
            this.currentTargetPosition.copy(this.camera.position);
            this.currentLookAtPosition.copy(position);
        }
    }
    
    /**
     * Clear the follow target
     */
    clearFollowTarget() {
        this.followTarget = null;
    }
    
    /**
     * Update camera position when following a target
     * @param {THREE.Vector3} targetPosition - Target position for camera
     * @param {THREE.Vector3} lookAtPosition - Position to look at
     * @param {number} deltaTime - Time since last update
     */
    updateFollowPosition(targetPosition, lookAtPosition, deltaTime) {
        if (!this.enableMouseControls) { // Only update if in auto mode
            // Smoothly interpolate to the target position
            this.currentTargetPosition.lerp(targetPosition, this.followLerpFactor);
            this.currentLookAtPosition.lerp(lookAtPosition, this.followLerpFactor);
            
            // Update camera position
            this.camera.position.copy(this.currentTargetPosition);
            
            // Make camera look at target
            this.camera.lookAt(this.currentLookAtPosition);
            
            // Update current look-at for consistency across different camera control modes
            this.currentLookAt.copy(this.currentLookAtPosition);
        }
    }
    
    /**
     * Enable or disable mouse controls
     * @param {boolean} enabled - Whether mouse controls should be enabled
     */
    setMouseControlsEnabled(enabled) {
        this.enableMouseControls = enabled;
        
        // If enabling, initialize orbit parameters based on current camera position
        if (enabled) {
            // Calculate current distance from camera to look-at point
            const offset = new THREE.Vector3().subVectors(this.camera.position, this.currentLookAt);
            this.orbitRadius = offset.length();
            
            // Calculate horizontal and vertical angles from current position
            this.orbitAngleHorizontal = Math.atan2(offset.x, offset.z);
            this.orbitAngleVertical = Math.asin(Math.min(1, Math.max(-1, offset.y / this.orbitRadius)));
        }
    }
    
    /**
     * Set references to game objects
     * @param {Character} character - Reference to character
     * @param {Environment} environment - Reference to environment
     */
    setReferences(character, environment) {
        this.character = character;
        this.environment = environment;
    }
    
    /**
     * Animate camera to start position
     */
    animateToStartPosition() {
        // Dramatic overview of both mountains
        const position = this.startPosition.clone();
        const lookAt = this.startLookAt.clone();
        
        // Add subtle movement
        position.x += (Math.random() - 0.5) * 10;
        
        this.animateToPosition(position, lookAt, 2.5);
        
        // Disable mouse controls for intro
        this.setMouseControlsEnabled(false);
    }
    
    /**
     * Animate camera to gameplay position
     */
    animateToGameplayPosition() {
        // Check if we have references to calculate better positions
        if (this.character && this.character.model && this.environment && 
            this.environment.startPlatformPosition) {
            
            // First, focus on the character on the platform
            this.animateToPlatformFocus();
            
            // After a delay, transition to gameplay position
            setTimeout(() => {
                const characterPos = this.character.model.position.clone();
                
                // Position behind and slightly above character - closer third-person view
                const position = new THREE.Vector3(
                    characterPos.x, 
                    characterPos.y + 3, // Was +5, lowered to +3
                    characterPos.z + 8   // Was +15, lowered to +8
                );
                
                // Look ahead on the rope - closer to character
                const lookAt = new THREE.Vector3(
                    characterPos.x,
                    characterPos.y + 1, // Added +1 to look slightly higher
                    characterPos.z - 10 // Was -20, changed to -10 to look closer
                );
                
                // Set follow target for continuous following
                this.setFollowTarget(this.character.model);
                
                // Animate with faster speed for gameplay
                this.currentAnimationSpeed = 0.15;
                this.animateToPosition(position, lookAt, 1.8);
                
                // Enable mouse controls after animation is complete
                setTimeout(() => {
                    this.setMouseControlsEnabled(true);
                }, 2000);
                
            }, 3000); // 3 second delay
        } else {
            // Fallback to predefined position if references not available
            this.gameplayPosition = new THREE.Vector3(0, 5, 8); // Adjust default position too
            this.gameplayLookAt = new THREE.Vector3(0, 1, -10); // Adjust default look-at too
            this.animateToPosition(this.gameplayPosition, this.gameplayLookAt);
            
            // Enable mouse controls after animation is complete
            setTimeout(() => {
                this.setMouseControlsEnabled(true);
            }, 3000);
        }
    }
    
    /**
     * Animate camera to focus on the starting platform
     */
    animateToPlatformFocus() {
        if (!this.environment || !this.environment.startPlatformPosition) {
            return;
        }
        
        // Get platform position
        const platformPos = this.environment.startPlatformPosition.clone();
        
        // Calculate dramatic position to view the platform
        const position = new THREE.Vector3(
            platformPos.x + 10, 
            platformPos.y + 6, 
            platformPos.z + 10
        );
        
        // Look at platform with slight offset to see character
        const lookAt = new THREE.Vector3(
            platformPos.x,
            platformPos.y + 1,
            platformPos.z - 3
        );
        
        // Use slower speed for more dramatic effect
        this.currentAnimationSpeed = 0.06;
        this.animateToPosition(position, lookAt, 3.0);
    }
    
    /**
     * Animate camera to a specific position and look-at point
     * @param {THREE.Vector3} position - Target position
     * @param {THREE.Vector3} lookAt - Target look-at point
     * @param {number} duration - Animation duration in seconds (optional)
     */
    animateToPosition(position, lookAt, duration = null) {
        this.isAnimating = true;
        this.animationProgress = 0;
        
        if (duration !== null) {
            this.animationDuration = duration;
        }
        
        this.targetPosition.copy(position);
        this.targetLookAt.copy(lookAt);
    }
    
    /**
     * Update camera animation
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        if (this.isAnimating) {
            // Update animation progress
            this.animationProgress += deltaTime / this.animationDuration;
            
            if (this.animationProgress >= 1.0) {
                // Animation complete
                this.animationProgress = 1.0;
                this.isAnimating = false;
            }
            
            // Use smoothstep for ease-in-out animation
            const t = this.smoothstep(this.animationProgress);
            
            // Interpolate camera position
            this.camera.position.lerpVectors(
                this.camera.position,
                this.targetPosition,
                t * this.currentAnimationSpeed
            );
            
            // Interpolate look-at position
            this.currentLookAt.lerpVectors(
                this.currentLookAt,
                this.targetLookAt,
                t * this.currentAnimationSpeed
            );
            
            // Update camera orientation
            this.camera.lookAt(this.currentLookAt);
        } else if (this.enableMouseControls) {
            // Mouse controls are active and no animation is in progress
            // Camera position updates are handled by mouse events
        } else if (this.followTarget && !this.enableMouseControls) {
            // Follow target if set and not in mouse control mode
            this.updateFollowingBehavior(deltaTime);
        } else if (this.character && this.character.model && 
                  !this.character.isOnPlatform && this.character.state !== 'FALLING') {
            // Legacy follow behavior from existing code, when no explicit follow target is set
            this.followTarget(this.character.model.position);
        }
    }
    
    /**
     * Update the following behavior
     * @param {number} deltaTime - Time since last update
     */
    updateFollowingBehavior(deltaTime) {
        if (!this.followTarget) return;
        
        const targetPos = this.followTarget.position.clone();
        
        // Check if character is on platform to apply direction-based offset
        if (this.character && this.character.isOnPlatform) {
            const facingDirection = this.character.facingDirection;
            
            // Calculate direction-aware camera position
            const offset = new THREE.Vector3(
                Math.sin(facingDirection) * this.followOffset.z,
                this.followOffset.y,
                Math.cos(facingDirection) * this.followOffset.z
            );
            
            // Set target position behind character based on facing direction
            const desiredPosition = new THREE.Vector3(
                targetPos.x - offset.x,
                targetPos.y + offset.y,
                targetPos.z - offset.z
            );
            
            // Smoothly interpolate current position
            this.camera.position.lerp(desiredPosition, this.followLerpFactor);
            
            // Look at position in front of character based on facing direction
            const lookAhead = new THREE.Vector3(
                Math.sin(facingDirection) * 5,
                1,
                Math.cos(facingDirection) * 5
            );
            
            const lookAtPoint = new THREE.Vector3(
                targetPos.x + lookAhead.x,
                targetPos.y + lookAhead.y,
                targetPos.z + lookAhead.z
            );
            
            this.currentLookAt.lerp(lookAtPoint, this.followLerpFactor * 1.5);
        } else {
            // Standard follow behavior for rope walking
            const desiredPosition = new THREE.Vector3(
                targetPos.x,
                targetPos.y + this.followOffset.y,
                targetPos.z + this.followOffset.z
            );
            
            this.camera.position.lerp(desiredPosition, this.followLerpFactor);
            this.currentLookAt.lerp(targetPos, this.followLerpFactor * 1.5);
        }
        
        // Update camera to look at the target
        this.camera.lookAt(this.currentLookAt);
    }
    
    /**
     * Legacy follow method
     * @param {THREE.Vector3} targetPosition - Position to follow
     */
    followTarget(targetPosition) {
        // Offset from target - more like a standard third-person camera
        // Closer behind and slightly above, like in FPS games
        const offset = new THREE.Vector3(0, 3, 8); // Reduced distance (was 0, 5, 15)
        
        // Set camera position relative to target with smooth interpolation
        const desiredPosition = targetPosition.clone().add(offset);
        this.camera.position.lerp(desiredPosition, 0.05);
        
        // Look at target plus a forward vector (closer to character)
        const lookAtPoint = targetPosition.clone().add(new THREE.Vector3(0, 1, -5)); // Was (0, 0, -10)
        this.currentLookAt.lerp(lookAtPoint, 0.1);
        this.camera.lookAt(this.currentLookAt);
    }
    
    /**
     * Smoothstep function for smooth animation
     * @param {number} x - Input value between 0 and 1
     * @returns {number} - Smoothed value between 0 and 1
     * @private
     */
    smoothstep(x) {
        return x * x * (3 - 2 * x);
    }
}

export { CameraController }; 