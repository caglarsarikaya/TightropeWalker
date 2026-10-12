/**
 * Environment.js
 * Handles the game environment - mountains, rope, sky, wind visuals, etc.
 * Owns the single source of truth for surface heights (platform deck, rope).
 */

import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import gameConfig from '../../config/gameConfig.js';

const ROPE_CONTROL_POINTS = 33;
const ROPE_TUBULAR_SEGMENTS = 120;
const ROPE_RADIAL_SEGMENTS = 8;
const UP = new THREE.Vector3(0, 1, 0);

class Environment {
    /**
     * @param {THREE.Scene} scene - The Three.js scene
     * @param {object} config - Environment config section
     */
    constructor(scene, config = gameConfig.environment) {
        this.scene = scene;
        this.config = config;

        this.rope = null;
        this.mountains = [];
        this.clouds = [];
        this.lights = [];
        this.platforms = [];

        this.mountainDistance = config.mountainDistance;
        this.mountainHeight = config.mountainHeight;
        this.mountainRadius = config.mountainRadius;
        this.platformRadius = config.platformRadius;
        this.platformHeight = config.platformHeight;
        this.ropeRadius = config.ropeRadius;

        this.startPlatformPosition = null;
        this.endPlatformPosition = null;

        // Live rope state
        this.ropeBasePoints = [];
        this.ropeCurve = null;
        this.ropeLength = 0;
        this.ropeSide = new THREE.Vector3(1, 0, 0);
        this.ropeSway = 0;
        this.ropeSwayVelocity = 0;
        this.ropeDip = 0;
        this.ropeDipVelocity = 0;
        this.ropeLeanPush = 0;
        this.ropeLoadT = 0;
        this.ropeTime = 0;

        // Shadow-casting sun that follows the action
        this.sun = null;
        this.sunOffset = new THREE.Vector3(40, 70, 25);

        this.windStreaks = null;
        this.noise = null;

        // Scratch objects
        this._p = new THREE.Vector3();
        this._t = new THREE.Vector3();
        this._n = new THREE.Vector3();
        this._b = new THREE.Vector3();
        this._v = new THREE.Vector3();
    }

    /**
     * Load environment assets and create scene objects
     */
    async load() {
        this.noise = new SimplexNoise();

        this.createSkybox();
        this.createLighting();
        this.createTerrain();
        this.createMountains();
        this.createPlatforms();
        this.createRope();
        this.createClouds();
        this.createWindStreaks();
    }

    // ------------------------------------------------------------------
    // Queries used by the character and camera
    // ------------------------------------------------------------------

    /**
     * Height of the walkable top of the platforms
     */
    getPlatformSurfaceY() {
        return this.startPlatformPosition.y + this.platformHeight / 2;
    }

    /**
     * Point on the rope's center line (live, including sway and dip)
     * @param {number} t - 0 (start anchor) to 1 (end anchor)
     * @param {THREE.Vector3} target
     */
    getRopePoint(t, target = new THREE.Vector3()) {
        return this.ropeCurve.getPointAt(THREE.MathUtils.clamp(t, 0, 1), target);
    }

    /**
     * Unit tangent of the rope at t
     */
    getRopeTangent(t, target = new THREE.Vector3()) {
        return this.ropeCurve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1), target);
    }

    getRopeStart(target = new THREE.Vector3()) {
        return target.copy(this.ropeBasePoints[0]);
    }

    getRopeEnd(target = new THREE.Vector3()) {
        return target.copy(this.ropeBasePoints[this.ropeBasePoints.length - 1]);
    }

    /**
     * Lowest height the camera may go near a world position
     */
    getGroundHeightNear(position) {
        const surfaceY = this.getPlatformSurfaceY();
        for (const center of [this.startPlatformPosition, this.endPlatformPosition]) {
            const dx = position.x - center.x;
            const dz = position.z - center.z;
            if (dx * dx + dz * dz < (this.platformRadius + 2) ** 2) {
                return surfaceY;
            }
        }
        return -10;
    }

    // ------------------------------------------------------------------
    // Scene construction
    // ------------------------------------------------------------------

    createSkybox() {
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

        const skyMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xafffff) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            side: THREE.BackSide,
            depthWrite: false
        });

        const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 32), skyMaterial);
        this.scene.add(sky);
        this.scene.fog = new THREE.Fog(0xb8e4ff, 250, 900);
    }

    createLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0xbfd9ff, 0x5a5040, 0.6);
        this.scene.add(hemisphereLight);
        this.lights.push(hemisphereLight);

        // The sun follows the focus point (see setFocus) so its shadow map
        // can stay small and sharp around the walker.
        const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 250;
        sun.shadow.camera.left = -35;
        sun.shadow.camera.right = 35;
        sun.shadow.camera.top = 35;
        sun.shadow.camera.bottom = -35;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.03;
        sun.position.copy(this.sunOffset);
        this.scene.add(sun);
        this.scene.add(sun.target);
        this.sun = sun;
        this.lights.push(sun);
    }

    /**
     * Move the shadow-casting sun to keep the walker inside its shadow map
     * @param {THREE.Vector3} focus - World position to center shadows on
     */
    setFocus(focus) {
        if (!this.sun) return;
        this.sun.target.position.copy(focus);
        this.sun.position.copy(focus).add(this.sunOffset);
        this.focus = focus;
    }

    createTerrain() {
        const terrainSize = 1600;
        const terrainSegments = 120;
        const flatRadius = this.mountainDistance + this.mountainRadius;

        const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
        geometry.rotateX(-Math.PI / 2);

        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            const distanceFromCenter = Math.sqrt(x * x + z * z);

            if (distanceFromCenter > flatRadius) {
                const noiseHeight = this.noise.noise(x * 0.01, z * 0.01) * 15;
                const falloffFactor = Math.min(1, (distanceFromCenter - flatRadius) / 50);
                vertices[i + 1] = noiseHeight * falloffFactor - 10;
            } else {
                vertices[i + 1] = -10;
            }
        }
        geometry.computeVertexNormals();

        const textureLoader = new THREE.TextureLoader();
        const grassTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
        grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(60, 60);

        const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.8,
            metalness: 0.1,
            color: 0x507050
        }));
        terrain.receiveShadow = true;
        this.scene.add(terrain);
    }

    createMountains() {
        this.startPlatformPosition = new THREE.Vector3(0, this.mountainHeight / 2, this.mountainDistance);
        this.endPlatformPosition = new THREE.Vector3(0, this.mountainHeight / 2, -this.mountainDistance);

        this.createRealisticMountain(new THREE.Vector3(0, 0, this.mountainDistance));
        this.createRealisticMountain(new THREE.Vector3(0, 0, -this.mountainDistance));
    }

    /**
     * Create a rocky mountain with a flat summit plateau for the platform
     * @param {THREE.Vector3} position - Center of the mountain (its top is at y + height/2)
     */
    createRealisticMountain(position) {
        const height = this.mountainHeight;
        const radius = this.mountainRadius;
        const plateauRadius = this.platformRadius * 1.3;

        // Truncated cone: the summit is a plateau the platform sits flush on
        const geometry = new THREE.CylinderGeometry(plateauRadius, radius, height, 48, 32, false);
        const vertices = geometry.attributes.position.array;

        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < vertices.length; i += 3) {
            minY = Math.min(minY, vertices[i + 1]);
            maxY = Math.max(maxY, vertices[i + 1]);
        }

        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const z = vertices[i + 2];
            const heightFactor = (y - minY) / (maxY - minY);
            const distFromCenter = Math.sqrt(x * x + z * z);
            if (distFromCenter < 1e-4) continue;

            // Keep the summit ring untouched so the plateau stays flat
            const summitFade = 1 - THREE.MathUtils.smoothstep(heightFactor, 0.85, 1.0);
            const noiseScale = 0.1 + heightFactor * 0.3;
            const noiseMagnitude = 2 + heightFactor * 3;
            const detailNoise = this.noise.noise(x * 0.5, y * 0.5, z * 0.5) * 0.5;
            const rockNoise = this.noise.noise(x * noiseScale, y * noiseScale, z * noiseScale) * noiseMagnitude;
            const displacement = (rockNoise + detailNoise) * summitFade;

            vertices[i] += (x / distFromCenter) * displacement;
            vertices[i + 1] += displacement * 0.3 * (heightFactor < 0.98 ? 1 : 0);
            vertices[i + 2] += (z / distFromCenter) * displacement;
        }
        geometry.computeVertexNormals();

        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });

        const mountain = new THREE.Mesh(geometry, rockMaterial);
        mountain.position.copy(position);
        mountain.castShadow = true;
        mountain.receiveShadow = true;
        this.scene.add(mountain);
        this.mountains.push(mountain);

        // Snow cap: same shape, slightly inflated, only above the snow line
        const snowCapGeometry = geometry.clone();
        const snowVertices = snowCapGeometry.attributes.position.array;
        for (let i = 0; i < snowVertices.length; i += 3) {
            const y = snowVertices[i + 1];
            const heightFactor = (y - minY) / (maxY - minY);
            const snowThreshold = 0.65 + this.noise.noise(snowVertices[i] * 0.1, snowVertices[i + 2] * 0.1) * 0.1;

            if (heightFactor < snowThreshold) {
                snowVertices[i] *= 0.98;
                snowVertices[i + 1] = minY - 10;
                snowVertices[i + 2] *= 0.98;
            } else {
                snowVertices[i] *= 1.01;
                snowVertices[i + 1] += 0.03;
                snowVertices[i + 2] *= 1.01;
            }
        }
        snowCapGeometry.computeVertexNormals();

        const snowCap = new THREE.Mesh(snowCapGeometry, new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.1
        }));
        snowCap.position.copy(position);
        snowCap.castShadow = true;
        snowCap.receiveShadow = true;
        this.scene.add(snowCap);

        this.addRockFormations(position);
    }

    /**
     * Scatter rocks around the mountain foot, on the terrain
     */
    addRockFormations(mountainPosition) {
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true
        });

        const numRocks = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numRocks; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.mountainRadius * (0.75 + Math.random() * 0.35);
            const rockSize = 2 + Math.random() * 5;

            const rockGeometry = Math.random() > 0.5
                ? new THREE.SphereGeometry(rockSize, 8, 6)
                : new THREE.ConeGeometry(rockSize, 2 + Math.random() * 5, 8);

            const vertices = rockGeometry.attributes.position.array;
            for (let j = 0; j < vertices.length; j += 3) {
                const noise = this.noise.noise(vertices[j] * 0.3, vertices[j + 1] * 0.3, vertices[j + 2] * 0.3) * 1.5;
                vertices[j] += vertices[j] * 0.2 * noise;
                vertices[j + 1] += vertices[j + 1] * 0.2 * noise;
                vertices[j + 2] += vertices[j + 2] * 0.2 * noise;
            }
            rockGeometry.computeVertexNormals();

            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(
                mountainPosition.x + Math.cos(angle) * distance,
                -10 + Math.random(),
                mountainPosition.z + Math.sin(angle) * distance
            );
            rock.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    createPlatforms() {
        const textureLoader = new THREE.TextureLoader();
        const woodTexture = textureLoader.load('https://threejs.org/examples/textures/hardwood2_diffuse.jpg');
        woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(2, 2);

        const platformMaterial = new THREE.MeshStandardMaterial({
            map: woodTexture,
            roughness: 0.8,
            metalness: 0.1
        });

        for (const center of [this.startPlatformPosition, this.endPlatformPosition]) {
            const geometry = new THREE.CylinderGeometry(
                this.platformRadius,
                this.platformRadius * 1.05,
                this.platformHeight,
                32
            );
            const platform = new THREE.Mesh(geometry, platformMaterial);
            platform.position.copy(center);
            platform.castShadow = true;
            platform.receiveShadow = true;
            this.scene.add(platform);
            this.platforms.push(platform);
        }
    }

    /**
     * Railing around a platform with a gate where the rope is anchored
     * @param {THREE.Vector3} center - Platform center
     * @param {THREE.Vector3} anchor - Rope anchor point on this platform's edge
     */
    addPlatformRailing(center, anchor) {
        const railingHeight = 1.1;
        const postRadius = 0.06;
        const postCount = 24;
        const radius = this.platformRadius - 0.1;
        const surfaceY = this.getPlatformSurfaceY();
        const gateAngle = Math.atan2(anchor.z - center.z, anchor.x - center.x);
        const gateHalfWidth = 0.75; // meters either side of the rope

        const material = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 });
        const postGeometry = new THREE.CylinderGeometry(postRadius, postRadius, railingHeight, 8);

        // Angles of posts, leaving a gap around the rope
        const gateAngularHalf = Math.asin(gateHalfWidth / radius);
        const angles = [];
        for (let i = 0; i < postCount; i++) {
            const angle = gateAngle + gateAngularHalf + (i / (postCount - 1)) * (Math.PI * 2 - 2 * gateAngularHalf);
            angles.push(angle);
        }

        const postPositions = angles.map(angle => new THREE.Vector3(
            center.x + Math.cos(angle) * radius,
            surfaceY + railingHeight / 2,
            center.z + Math.sin(angle) * radius
        ));

        for (const position of postPositions) {
            const post = new THREE.Mesh(postGeometry, material);
            post.position.copy(position);
            post.castShadow = true;
            this.scene.add(post);
        }

        // Top rails between neighbouring posts (no rail across the gate)
        for (let i = 0; i < postPositions.length - 1; i++) {
            const a = postPositions[i].clone().setY(surfaceY + railingHeight);
            const b = postPositions[i + 1].clone().setY(surfaceY + railingHeight);
            const length = a.distanceTo(b);
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, length, 6), material);
            rail.position.copy(a).add(b).multiplyScalar(0.5);
            rail.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
            rail.castShadow = true;
            this.scene.add(rail);
        }

        // Anchor block the rope is tied to
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.25, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.5 })
        );
        block.position.set(anchor.x, surfaceY + 0.125, anchor.z);
        block.castShadow = true;
        block.receiveShadow = true;
        this.scene.add(block);
    }

    /**
     * Create the rope as a tube whose vertices are rewritten every frame
     */
    createRope() {
        const surfaceY = this.getPlatformSurfaceY();
        const anchorY = surfaceY + 0.25 + this.ropeRadius;

        const start = new THREE.Vector3(
            this.startPlatformPosition.x,
            anchorY,
            this.startPlatformPosition.z - this.platformRadius
        );
        const end = new THREE.Vector3(
            this.endPlatformPosition.x,
            anchorY,
            this.endPlatformPosition.z + this.platformRadius
        );

        const span = start.distanceTo(end);
        const maxSag = span * this.config.ropeSagRatio;

        for (let i = 0; i < ROPE_CONTROL_POINTS; i++) {
            const u = i / (ROPE_CONTROL_POINTS - 1);
            const point = new THREE.Vector3().lerpVectors(start, end, u);
            point.y -= Math.sin(Math.PI * u) * maxSag;
            this.ropeBasePoints.push(point);
        }

        this.ropeCurve = new THREE.CatmullRomCurve3(this.ropeBasePoints.map(p => p.clone()));
        this.ropeLength = this.ropeCurve.getLength();

        const ropeDirection = new THREE.Vector3().subVectors(end, start).normalize();
        this.ropeSide.crossVectors(ropeDirection, UP).normalize();

        const ropeGeometry = new THREE.TubeGeometry(
            this.ropeCurve,
            ROPE_TUBULAR_SEGMENTS,
            this.ropeRadius,
            ROPE_RADIAL_SEGMENTS,
            false
        );

        this.rope = new THREE.Mesh(ropeGeometry, new THREE.MeshStandardMaterial({
            map: this.createRopeTexture(),
            color: 0xd8b27a,
            roughness: 0.9,
            metalness: 0.0
        }));
        this.rope.castShadow = true;
        this.rope.receiveShadow = true;
        this.rope.frustumCulled = false; // Vertices move every frame
        this.scene.add(this.rope);

        this.addPlatformRailing(this.startPlatformPosition, start);
        this.addPlatformRailing(this.endPlatformPosition, end);

        this.rebuildRopeGeometry();
    }

    /**
     * Procedural twisted-strand texture (no external image needed)
     */
    createRopeTexture() {
        if (typeof document === 'undefined') return null;

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#c9a46a';
        ctx.fillRect(0, 0, 64, 32);

        // Diagonal strands
        ctx.lineWidth = 6;
        for (let x = -64; x < 128; x += 16) {
            ctx.strokeStyle = '#9c7642';
            ctx.beginPath();
            ctx.moveTo(x, 32);
            ctx.lineTo(x + 32, 0);
            ctx.stroke();
            ctx.strokeStyle = '#e2c48f';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 5, 32);
            ctx.lineTo(x + 37, 0);
            ctx.stroke();
            ctx.lineWidth = 6;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(Math.round(this.ropeLength / 0.12), 1);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    /**
     * Rewrite the tube vertices to follow the live curve
     */
    rebuildRopeGeometry() {
        const geometry = this.rope.geometry;
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        const P = this._p;
        const T = this._t;
        const N = this._n;
        const B = this._b;
        const normal = this._v;

        let index = 0;
        for (let i = 0; i <= ROPE_TUBULAR_SEGMENTS; i++) {
            const u = i / ROPE_TUBULAR_SEGMENTS;
            this.ropeCurve.getPointAt(u, P);
            this.ropeCurve.getTangentAt(u, T);

            // Stable frame: N points as close to world-up as possible
            N.copy(UP).addScaledVector(T, -UP.dot(T)).normalize();
            B.crossVectors(T, N);

            for (let j = 0; j <= ROPE_RADIAL_SEGMENTS; j++) {
                const v = (j / ROPE_RADIAL_SEGMENTS) * Math.PI * 2;
                const sin = Math.sin(v);
                const cos = -Math.cos(v);
                normal.set(
                    cos * N.x + sin * B.x,
                    cos * N.y + sin * B.y,
                    cos * N.z + sin * B.z
                ).normalize();

                positions[index] = P.x + this.ropeRadius * normal.x;
                positions[index + 1] = P.y + this.ropeRadius * normal.y;
                positions[index + 2] = P.z + this.ropeRadius * normal.z;
                normals[index] = normal.x;
                normals[index + 1] = normal.y;
                normals[index + 2] = normal.z;
                index += 3;
            }
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.normal.needsUpdate = true;
    }

    /**
     * A footstep landing on the rope makes it bounce a little
     * @param {number} strength - 0..1
     */
    kickRope(strength) {
        this.ropeDipVelocity += 0.25 * strength;
    }

    /**
     * Simulate rope sway (wind), dip (walker's weight) and lean reaction
     * @param {number} deltaTime
     * @param {object} state - { wind, load: {active, t, lean} }
     */
    updateRope(deltaTime, state) {
        const windLateral = state.wind * this.ropeSide.x;
        const load = state.load || { active: false, t: 0, lean: 0 };
        this.ropeTime += deltaTime;

        // Lateral sway: under-damped spring pushed by the wind
        const swayTarget = windLateral * this.config.ropeSwayPerWind;
        const swayAccel = 3.0 * (swayTarget - this.ropeSway) - 0.9 * this.ropeSwayVelocity;
        this.ropeSwayVelocity += swayAccel * deltaTime;
        this.ropeSway += this.ropeSwayVelocity * deltaTime;

        // Vertical dip under the walker: stiff spring so steps make it bounce
        const loadT = THREE.MathUtils.clamp(load.t, 0.001, 0.999);
        this.ropeLoadT = loadT;
        const dipTarget = load.active ? this.config.ropeLoadDip * 4 * loadT * (1 - loadT) : 0;
        const dipAccel = 30 * (dipTarget - this.ropeDip) - 4 * this.ropeDipVelocity;
        this.ropeDipVelocity += dipAccel * deltaTime;
        this.ropeDip += this.ropeDipVelocity * deltaTime;

        // Leaning pushes the rope the opposite way under the feet
        const pushTarget = load.active ? -load.lean * 0.35 : 0;
        this.ropeLeanPush += (pushTarget - this.ropeLeanPush) * (1 - Math.exp(-6 * deltaTime));

        // Small high-frequency flutter in strong wind
        const flutter = Math.sin(this.ropeTime * 7.3) * 0.04 * Math.abs(windLateral);

        const points = this.ropeCurve.points;
        for (let i = 0; i < points.length; i++) {
            const u = i / (points.length - 1);
            const triangle = u < loadT ? u / loadT : (1 - u) / (1 - loadT);
            const lateral = this.ropeSway * Math.sin(Math.PI * u) +
                this.ropeLeanPush * triangle +
                flutter * Math.sin(2 * Math.PI * u);

            points[i].copy(this.ropeBasePoints[i])
                .addScaledVector(this.ropeSide, lateral);
            points[i].y -= this.ropeDip * triangle;
        }

        // The mesh is rebuilt once per rendered frame (rebuildRopeGeometry)
        this.ropeCurve.updateArcLengths();
    }

    createClouds() {
        const cloudMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1.0,
            metalness: 0.0,
            transparent: true,
            opacity: 0.9
        });

        for (let i = 0; i < 18; i++) {
            const cloudGroup = new THREE.Group();
            const numSpheres = 4 + Math.floor(Math.random() * 5);

            for (let j = 0; j < numSpheres; j++) {
                const radius = 8 + Math.random() * 8;
                const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), cloudMaterial);
                sphere.position.set(
                    j * 10 - numSpheres * 5 + Math.random() * 10,
                    Math.random() * 5,
                    Math.random() * 10
                );
                sphere.scale.y = 0.6 + Math.random() * 0.2;
                cloudGroup.add(sphere);
            }

            cloudGroup.position.set(
                Math.random() * 800 - 400,
                110 + Math.random() * 60,
                Math.random() * 800 - 400
            );
            const cloudScale = 0.8 + Math.random() * 1.5;
            cloudGroup.scale.setScalar(cloudScale);
            cloudGroup.userData.baseSpeed = 0.5 + Math.random();

            this.scene.add(cloudGroup);
            this.clouds.push(cloudGroup);
        }
    }

    /**
     * Thin streaks that drift with the wind so the player can see it
     */
    /**
     * Graphics quality: 'high' or 'low' (no sun shadows, fewer wind streaks)
     */
    setQuality(quality) {
        const high = quality !== 'low';
        if (this.sun) this.sun.castShadow = high;
        if (this.windStreaks) {
            const count = high ? this.windStreakOffsets.length : Math.floor(this.windStreakOffsets.length / 3);
            this.windStreaks.geometry.setDrawRange(0, count * 2);
        }
    }

    createWindStreaks() {
        const count = this.config.windStreaks;
        const positions = new Float32Array(count * 2 * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        this.windStreaks = new THREE.LineSegments(geometry, material);
        this.windStreaks.frustumCulled = false;
        this.windStreakExtent = new THREE.Vector3(30, 12, 30);
        this.windStreakOffsets = [];
        for (let i = 0; i < count; i++) {
            this.windStreakOffsets.push(new THREE.Vector3(
                (Math.random() * 2 - 1) * this.windStreakExtent.x,
                (Math.random() * 2 - 1) * this.windStreakExtent.y,
                (Math.random() * 2 - 1) * this.windStreakExtent.z
            ));
        }
        this.scene.add(this.windStreaks);
    }

    updateWindStreaks(deltaTime, wind) {
        if (!this.windStreaks) return;

        const strength = Math.abs(wind);
        const focus = this.focus || this.startPlatformPosition;
        const extent = this.windStreakExtent;
        const speed = wind * 18;
        const length = 0.5 + strength * 3;
        const direction = Math.sign(wind) || 1;
        const positions = this.windStreaks.geometry.attributes.position.array;

        this.windStreaks.material.opacity = Math.min(0.55, strength * 0.9);

        for (let i = 0; i < this.windStreakOffsets.length; i++) {
            const offset = this.windStreakOffsets[i];
            offset.x += speed * deltaTime * (0.7 + (i % 5) * 0.1);
            if (offset.x > extent.x) offset.x -= extent.x * 2;
            if (offset.x < -extent.x) offset.x += extent.x * 2;

            const k = i * 6;
            positions[k] = focus.x + offset.x;
            positions[k + 1] = focus.y + offset.y;
            positions[k + 2] = focus.z + offset.z;
            positions[k + 3] = positions[k] - direction * length;
            positions[k + 4] = positions[k + 1];
            positions[k + 5] = positions[k + 2];
        }
        this.windStreaks.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Update environment elements
     * @param {number} deltaTime
     * @param {object} state - { wind, load: {active, t, lean} }
     */
    update(deltaTime, state = { wind: 0 }) {
        const wind = state.wind || 0;

        for (const cloud of this.clouds) {
            cloud.position.x += (cloud.userData.baseSpeed + wind * 8) * deltaTime;
            if (cloud.position.x > 400) cloud.position.x = -400;
            if (cloud.position.x < -400) cloud.position.x = 400;
        }

        this.updateRope(deltaTime, state);
        this.updateWindStreaks(deltaTime, wind);
    }

    /**
     * Return the rope to rest (used when restarting)
     */
    resetRope() {
        this.ropeSway = 0;
        this.ropeSwayVelocity = 0;
        this.ropeDip = 0;
        this.ropeDipVelocity = 0;
        this.ropeLeanPush = 0;
        this.updateRope(0, { wind: 0 });
        this.rebuildRopeGeometry();
    }
}

export { Environment };
