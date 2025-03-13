/**
 * Environment.js
 * Handles the game environment - mountains, rope, sky, etc.
 * Manages the 3D environment for the tightrope walker game
 */

import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

class Environment {
    /**
     * Initialize the game environment
     * @param {THREE.Scene} scene - The Three.js scene
     */
    constructor(scene) {
        this.scene = scene;
        this.rope = null;
        this.mountains = [];
        this.clouds = [];
        this.lights = [];
        
        // Rope properties
        this.ropeLength = 100;
        this.ropeSegments = 10;
        this.ropeThickness = 0.3;
        
        // Mountain properties
        this.mountainDistance = 100;
        this.mountainHeight = 100;
        this.mountainRadius = 100;
        
        // Platform properties
        this.platforms = [];
        this.platformRadius = 8;
        this.platformHeight = 2;
        this.startPlatformPosition = null;
        this.endPlatformPosition = null;
        
        // Noise generator for terrain
        this.noise = null;
    }
    
    /**
     * Load environment assets and create scene objects
     * @returns {Promise} - Promise that resolves when loading is complete
     */
    async load() {
        // Initialize noise generator
        this.noise = new SimplexNoise();
        
        // Add skybox
        this.createSkybox();
        
        // Add lighting
        this.createLighting();
        
        // Create terrain
        this.createTerrain();
        
        // Create mountains
        await this.createMountains();
        
        // Create platforms on mountain peaks
        this.createPlatforms();
        
        // Create rope
        this.createRope();
        
        // Create clouds
     //   this.createClouds();
        
        return Promise.resolve();
    }
    
    /**
     * Create a skybox for the scene
     */
    createSkybox() {
        // Create a realistic sky gradient
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `;
        
        const uniforms = {
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0xafffff) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };
        
        const skyMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: uniforms,
            side: THREE.BackSide
        });
        
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
    }
    
    /**
     * Create scene lighting
     */
    createLighting() {
        // Ambient light for global illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);
        
        // Directional light for shadows (sunlight)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 10;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -150;
        directionalLight.shadow.camera.right = 150;
        directionalLight.shadow.camera.top = 150;
        directionalLight.shadow.camera.bottom = -150;
        
        this.scene.add(directionalLight);
        this.lights.push(directionalLight);
        
        // Add hemisphere light for more natural outdoor lighting
        const hemisphereLight = new THREE.HemisphereLight(0x0088ff, 0x00ff88, 0.6);
        this.scene.add(hemisphereLight);
        this.lights.push(hemisphereLight);
    }
    
    /**
     * Create base terrain with realistic features
     */
    createTerrain() {
        // Create a large terrain with rolling hills
        const terrainSize = 1000;
        const terrainSegments = 100;
        
        // Generate terrain geometry with noise-based height
        const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
        geometry.rotateX(-Math.PI / 2); // Make it horizontal
        
        // Apply noise to terrain vertices
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            // Skip the center area where mountains will be
            const x = vertices[i];
            const z = vertices[i + 2];
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            
            if (distanceFromCenter > this.mountainRadius + 10) {
                // Apply noise-based height, decreasing near mountains
                const noiseHeight = this.noise.noise(x * 0.01, z * 0.01) * 15;
                const falloffFactor = Math.min(1, (distanceFromCenter - this.mountainRadius - 10) / 50);
                vertices[i + 1] = noiseHeight * falloffFactor - 10; // Base terrain height (-10)
            } else {
                // Flatten the area near mountains
                vertices[i + 1] = -10;
            }
        }
        
        // Update the geometry after modifying vertices
        geometry.computeVertexNormals();
        
        // Create terrain texture material with grass and dirt
        const textureLoader = new THREE.TextureLoader();
        const repeatFactor = 50;
        
        // Load textures asynchronously (would normally use await but simplified here)
        const grassTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
        grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(repeatFactor, repeatFactor);
        
        const terrainMaterial = new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.8,
            metalness: 0.1,
            color: 0x507050
        });
        
        const terrain = new THREE.Mesh(geometry, terrainMaterial);
        terrain.receiveShadow = true;
        
        this.scene.add(terrain);
    }
    
    /**
     * Create realistic mountains at each end of the rope
     */
    async createMountains() {
        // Use more complex geometry for realistic mountains
        await this.createRealisticMountain(
            new THREE.Vector3(0, 0, this.mountainDistance),
            this.mountainHeight,
            this.mountainRadius,
            true // Start mountain
        );
        
        await this.createRealisticMountain(
            new THREE.Vector3(0, 0, -this.mountainDistance),
            this.mountainHeight,
            this.mountainRadius,
            false // End mountain
        );
    }
    
    /**
     * Create a realistic mountain using noise-based displacement
     * Extend the mountain geometry to better integrate with platforms on top
     * @param {THREE.Vector3} position - The position of the mountain
     * @param {number} height - The height of the mountain
     * @param {number} radius - The radius of the mountain base
     * @param {boolean} isStartMountain - Whether this is the starting mountain
     */
    async createRealisticMountain(position, height, radius, isStartMountain) {
        // Create a more detailed cone with more segments
        const geometry = new THREE.ConeGeometry(
            radius,
            height,
            48, // More radial segments
            32, // More height segments
            false
        );
        
        // Apply noise to vertices to create rocky features
        const vertices = geometry.attributes.position.array;
        
        // Get the y range of the cone to apply appropriate noise
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < vertices.length; i += 3) {
            const y = vertices[i + 1];
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        
        // Apply noise based on height
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const z = vertices[i + 2];
            
            // Normalize height from 0 to 1
            const heightFactor = (y - minY) / (maxY - minY);
            
            // Calculate distance from center axis
            const distFromCenter = Math.sqrt(x * x + z * z);
            
            // Reduce noise near the very top to create a flatter platform area
            // Use a smoother transition for the top 5% of the mountain
            let topFlatteningFactor = 1.0;
            if (heightFactor > 0.95) {
                // Calculate how close we are to the very top (0 at 0.95, 1 at 1.0)
                const topFactor = (heightFactor - 0.95) / 0.05;
                // Reduce noise at the top for a flatter surface
                topFlatteningFactor = 1.0 - (topFactor * 0.9); // Gradually reduce to 0.1 at top
            }
            
            // Larger noise near the top (but not at the very top), smoother at the bottom
            const noiseScale = 0.1 + (heightFactor * 0.3 * topFlatteningFactor);
            const noiseMagnitude = 2 + (heightFactor * 3 * topFlatteningFactor);
            
            // Add some small scale noise for fine details
            const detailNoise = this.noise.noise(x * 0.5, y * 0.5, z * 0.5) * 0.5 * topFlatteningFactor;
            
            // Add medium scale noise for rock formations
            const rockNoise = this.noise.noise(x * noiseScale, y * noiseScale, z * noiseScale) * noiseMagnitude * topFlatteningFactor;
            
            // Less displacement near the top peak
            const peakSmoothingFactor = Math.max(0, 1 - Math.pow(heightFactor, 3) * 8);
            
            // Apply noise as displacement along normal (approximated)
            const normalizedX = x / distFromCenter;
            const normalizedZ = z / distFromCenter;
            
            if (!isNaN(normalizedX) && !isNaN(normalizedZ)) {
                vertices[i] += normalizedX * (rockNoise + detailNoise) * peakSmoothingFactor;
                // Less vertical displacement
                vertices[i + 1] += (rockNoise + detailNoise) * 0.3 * peakSmoothingFactor;
                vertices[i + 2] += normalizedZ * (rockNoise + detailNoise) * peakSmoothingFactor;
            }
        }
        
        // Update geometry after modifying vertices
        geometry.computeVertexNormals();
        
        // Create texture loader
        const textureLoader = new THREE.TextureLoader();
        
        // Create materials for different parts of the mountain
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x777777,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });
        
        const snowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Create the main mountain mesh
        const mountain = new THREE.Mesh(geometry, rockMaterial);
        mountain.position.copy(position);
        mountain.castShadow = true;
        mountain.receiveShadow = true;
        this.scene.add(mountain);
        this.mountains.push(mountain);
        
        // Create snow cap using the same noise pattern but only for the top portion
        const snowCapGeometry = geometry.clone();
        const snowCapVertices = snowCapGeometry.attributes.position.array;
        
        // Only keep the top portion for snow
        for (let i = 0; i < snowCapVertices.length; i += 3) {
            const y = snowCapVertices[i + 1];
            const heightFactor = (y - minY) / (maxY - minY);
            
            // Determine snow height with some noise for a natural look
            const x = snowCapVertices[i];
            const z = snowCapVertices[i + 2];
            const snowNoise = this.noise.noise(x * 0.1, z * 0.1) * 0.1;
            // Make snow cover more of the mountain - start at 65% instead of 70%
            const snowThreshold = 0.65 + snowNoise;
            
            if (heightFactor < snowThreshold) {
                // Below snow line - scale this vertex to be inside the mountain
                snowCapVertices[i] *= 0.98;  // Slightly shrink to avoid z-fighting
                snowCapVertices[i + 1] = minY - 10;  // Move below the mountain
                snowCapVertices[i + 2] *= 0.98;
            }
        }
        
        // Update snow cap geometry
        snowCapGeometry.computeVertexNormals();
        
        // Create snow cap mesh
        const snowCap = new THREE.Mesh(snowCapGeometry, snowMaterial);
        snowCap.position.copy(position);
        snowCap.castShadow = true;
        this.scene.add(snowCap);
        
        // Add some rock formations around the base
        this.addRockFormations(position, radius);
        
        // Create a slightly flatter area at the top for the platform
        this.createMountainTop(position, height, isStartMountain);
    }
    
    /**
     * Create a slightly flatter area at the mountain top for the platform
     * @param {THREE.Vector3} position - The position of the mountain
     * @param {number} mountainHeight - The height of the mountain
     * @param {boolean} isStartMountain - Whether this is the starting mountain
     */
    createMountainTop(position, mountainHeight, isStartMountain) {

        console.log(position, mountainHeight, isStartMountain);
        // Calculate the platform position at the top of the mountain
        const platformPosition = new THREE.Vector3(
            position.x,
            position.y + mountainHeight / 2 ,
            position.z
        );
        
        // Store this as the correct platform position
        if (isStartMountain) {
            this.startPlatformPosition = platformPosition;
        } else {
            this.endPlatformPosition = platformPosition;
        }
    }
    
    /**
     * Add rock formations around the mountain base
     * @param {THREE.Vector3} mountainPosition - The position of the mountain
     * @param {number} mountainRadius - The radius of the mountain base
     */
    addRockFormations(mountainPosition, mountainRadius) {
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x555555,
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true
        });
        
        // Create 8-12 rock formations around the mountain
        const numRocks = 8 + Math.floor(Math.random() * 5);
        const minDistance = mountainRadius * 0.5;
        const maxDistance = mountainRadius * 0.9;
        
        for (let i = 0; i < numRocks; i++) {
            // Random position around the mountain
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            
            // Random size for the rock
            const rockSize = 3 + Math.random() * 7;
            const rockHeight = 2 + Math.random() * 5;
            
            // Create rock geometry - use a sphere or cone with noise
            let rockGeometry;
            if (Math.random() > 0.5) {
                rockGeometry = new THREE.SphereGeometry(rockSize, 8, 6);
            } else {
                rockGeometry = new THREE.ConeGeometry(rockSize, rockHeight, 8);
            }
            
            // Apply noise to vertices
            const vertices = rockGeometry.attributes.position.array;
            for (let j = 0; j < vertices.length; j += 3) {
                const vx = vertices[j];
                const vy = vertices[j + 1];
                const vz = vertices[j + 2];
                
                // Apply 3D noise
                const noise = this.noise.noise(vx * 0.3, vy * 0.3, vz * 0.3) * 1.5;
                vertices[j] += vx * 0.2 * noise;
                vertices[j + 1] += vy * 0.2 * noise;
                vertices[j + 2] += vz * 0.2 * noise;
            }
            
            rockGeometry.computeVertexNormals();
            
            // Create rock mesh
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(
                mountainPosition.x + x,
                mountainPosition.y - 5 + (Math.random() * 2), // Slightly buried
                mountainPosition.z + z
            );
            
            // Random rotation
            rock.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }
    
    /**
     * Create platforms on mountain peaks
     */
    createPlatforms() {
        if (!this.startPlatformPosition || !this.endPlatformPosition) return;
        
        // Create wood texture for platforms
        const textureLoader = new THREE.TextureLoader();
        const woodTexture = textureLoader.load('https://threejs.org/examples/textures/hardwood2_diffuse.jpg');
        woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(2, 2);
        
        // Create platform material
        const platformMaterial = new THREE.MeshStandardMaterial({
            map: woodTexture,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Create start platform (cylindrical shape with more flattened appearance)
        const startPlatformGeometry = new THREE.CylinderGeometry(
            this.platformRadius, // top radius
            this.platformRadius * 1.05, // slightly wider bottom radius
            this.platformHeight, // height
            16 // radial segments
        );
        
        const startPlatform = new THREE.Mesh(startPlatformGeometry, platformMaterial);
        startPlatform.position.copy(this.startPlatformPosition); 
        startPlatform.receiveShadow = true;
        console.log("startPlatform",startPlatform);
        this.scene.add(startPlatform);
        this.platforms.push(startPlatform);
        
        // Create end platform
        const endPlatformGeometry = new THREE.CylinderGeometry(
            this.platformRadius,
            this.platformRadius * 1.05,
            this.platformHeight,
            16
        );
        
        const endPlatform = new THREE.Mesh(endPlatformGeometry, platformMaterial);
        endPlatform.position.copy(this.endPlatformPosition);
        endPlatform.receiveShadow = true;
        this.scene.add(endPlatform);
        this.platforms.push(endPlatform);
        
        // Add railing to platforms for visual detail
        this.addPlatformRailings(startPlatform, true);
        this.addPlatformRailings(endPlatform, false);
    }
    
    /**
     * Add railings to platforms
     * @param {THREE.Mesh} platform - The platform to add railings to
     * @param {boolean} isStartPlatform - Whether this is the starting platform
     */
    addPlatformRailings(platform, isStartPlatform) {
        const railingHeight = 1.2;
        const railingThickness = 0.1;
        const postCount = 8;
        
        // Create post material
        const postMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513, // Dark brown
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Create posts around the platform edge
        for (let i = 0; i < postCount; i++) {
            // Skip the area where the rope connects
            if (isStartPlatform && (i === 0 || i === postCount - 1)) continue;
            if (!isStartPlatform && (i === postCount/2 || i === postCount/2 - 1)) continue;
            
            const angle = (i / postCount) * Math.PI * 2;
            const x = Math.cos(angle) * (this.platformRadius - railingThickness/2);
            const z = Math.sin(angle) * (this.platformRadius - railingThickness/2);
            
            // Create post geometry
            const postGeometry = new THREE.CylinderGeometry(
                railingThickness,
                railingThickness,
                railingHeight,
                8
            );
            
            const post = new THREE.Mesh(postGeometry, postMaterial);
            post.position.set(
                platform.position.x + x,
                platform.position.y + this.platformHeight/2 + railingHeight/2,
                platform.position.z + z
            );
            
            post.castShadow = true;
            this.scene.add(post);
        }
    }
    
    /**
     * Create a rope between mountains
     */
    createRope() {
        // Check if platforms are created
        if (!this.startPlatformPosition || !this.endPlatformPosition) return;
        
        // Create a rope using a tube geometry with a subtle natural curve
        const ropePoints = [];
        
        // Start point on the edge of the starting platform
        const startPoint = new THREE.Vector3(
            this.startPlatformPosition.x,
            this.startPlatformPosition.y + this.platformHeight/2 + this.ropeThickness/2,
            this.startPlatformPosition.z - this.platformRadius
        );
        
        // End point on the edge of the end platform
        const endPoint = new THREE.Vector3(
            this.endPlatformPosition.x,
            this.endPlatformPosition.y + this.platformHeight/2 + this.ropeThickness/2,
            this.endPlatformPosition.z + this.platformRadius
        );
        
        // Use more segments for a smoother rope
        const segments = this.ropeSegments * 2;
        
        // Calculate a subtle sag amount - adjust the divisor to control tightness
        // Higher values = less sag, lower values = more sag
        const maxSag = this.mountainDistance / 40; // Just a slight sag
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            
            // Linear interpolation for x and z coordinates
            const x = startPoint.x + (endPoint.x - startPoint.x) * t;
            const z = startPoint.z + (endPoint.z - startPoint.z) * t;
            
            // Calculate base y position through linear interpolation
            const baseY = startPoint.y + (endPoint.y - startPoint.y) * t;
            
            // Apply a natural curve - most pronounced in the middle (at t=0.5)
            // Using a sine function to create a smooth natural-looking curve
            // sin(π*t) produces a nice curve that's 0 at t=0 and t=1, and 1 at t=0.5
            const sag = Math.sin(Math.PI * t) * maxSag;
            
            // Final y position is base height minus sag
            const y = baseY - sag;
            
            ropePoints.push(new THREE.Vector3(x, y, z));
        }
        
        // Create a curve from points
        const ropeCurve = new THREE.CatmullRomCurve3(ropePoints);
        
        // Create tube geometry from curve
        const ropeGeometry = new THREE.TubeGeometry(
            ropeCurve,
            segments, // More tubular segments for smoother curve
            this.ropeThickness,
            8, // Radial segments
            false // Not closed
        );
        
        // Create a textured rope material
        const textureLoader = new THREE.TextureLoader();
        const ropeTexture = textureLoader.load('https://threejs.org/examples/textures/rope.jpg');
        ropeTexture.wrapS = THREE.RepeatWrapping;
        ropeTexture.wrapT = THREE.RepeatWrapping;
        ropeTexture.repeat.set(15, 1);
        
        const ropeMaterial = new THREE.MeshStandardMaterial({ 
            map: ropeTexture,
            color: 0x8B4513, // Darker brown color
            roughness: 0.9,
            metalness: 0.0
        });
        
        this.rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
        this.rope.castShadow = true;
        
        this.scene.add(this.rope);
    }
    
    /**
     * Create clouds in the scene
     */
    createClouds() {
        // Create a volumetric-looking cloud material
        const cloudMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9
        });
        
        // Create more clouds for a dense sky
        for (let i = 0; i < 30; i++) {
            const cloudGroup = new THREE.Group();
            
            // Create 4-8 spheres per cloud for more volume
            const numSpheres = 4 + Math.floor(Math.random() * 5);
            
            for (let j = 0; j < numSpheres; j++) {
                const radius = 8 + Math.random() * 8;
                const sphereGeometry = new THREE.SphereGeometry(radius, 8, 8);
                const sphere = new THREE.Mesh(sphereGeometry, cloudMaterial);
                
                // Position spheres to form a cloud
                sphere.position.set(
                    j * 10 - (numSpheres * 5) + Math.random() * 10,
                    Math.random() * 5,
                    Math.random() * 10
                );
                
                // Slightly flatten the cloud spheres
                sphere.scale.y = 0.6 + Math.random() * 0.2;
                
                cloudGroup.add(sphere);
            }
            
            // Position cloud in sky
            cloudGroup.position.set(
                Math.random() * 600 - 300,
                80 + Math.random() * 50, // Higher clouds
                Math.random() * 600 - 300
            );
            
            // Scale entire cloud randomly
            const cloudScale = 0.8 + Math.random() * 1.5;
            cloudGroup.scale.set(cloudScale, cloudScale, cloudScale);
            
            this.scene.add(cloudGroup);
            this.clouds.push(cloudGroup);
            
            // Add cloud movement properties
            cloudGroup.userData = {
                speedX: (Math.random() * 2 - 1) * 3, // Faster movement
                speedZ: (Math.random() * 2 - 1) * 3,
                rotationSpeed: (Math.random() * 2 - 1) * 0.01 // Slow rotation
            };
        }
    }
    
    /**
     * Update environment elements
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // Update cloud positions
        for (const cloud of this.clouds) {
            cloud.position.x += cloud.userData.speedX * deltaTime;
            cloud.position.z += cloud.userData.speedZ * deltaTime;
            
            // Add gentle rotation for more dynamic clouds
            cloud.rotation.y += cloud.userData.rotationSpeed * deltaTime;
            
            // Loop clouds when they go too far
            if (cloud.position.x > 300) cloud.position.x = -300;
            if (cloud.position.x < -300) cloud.position.x = 300;
            if (cloud.position.z > 300) cloud.position.z = -300;
            if (cloud.position.z < -300) cloud.position.z = 300;
        }
    }
}

export { Environment }; 