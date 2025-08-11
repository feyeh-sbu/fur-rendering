import * as THREE from 'three';

/**
 * ShellGeometry - Generates shell geometry for fur rendering
 * Creates offset copies of the base mesh geometry displaced along surface normals
 * Implements the shell method as described in section 2.3 of the fur rendering paper
 */
export class ShellGeometry {
    constructor() {
        // Shell generation parameters
        this.shellCount = 16; // Default number of shell layers (8-32 range)
        this.shellSpacing = 0.02; // Distance between shell layers
        this.maxShellDistance = 0.3; // Maximum distance for outermost shell

        // Shell tapering parameters
        this.taperingEnabled = true; // Enable/disable shell tapering
        this.taperingIntensity = 0.7; // Tapering intensity (0.0 = no tapering, 1.0 = maximum tapering)
        this.taperingCurve = 'quadratic'; // Tapering curve type: 'linear', 'quadratic', 'exponential'
        this.taperingMethod = 'hybrid'; // Scaling method: 'centroid', 'normal', 'hybrid'

        // Generated shell geometries cache
        this.shellGeometries = [];
        this.baseGeometry = null;

        // Performance optimization settings
        this.useInstancedGeometry = true; // Use instanced rendering for better performance

        // Memory management
        this.geometryPool = new Map(); // Reuse geometries when possible
        this.maxPoolSize = 64; // Maximum number of cached geometries

        console.log('ShellGeometry initialized with performance optimizations');
    }

    /**
     * Set the number of shell layers to generate
     * @param {number} count - Number of shells (8-32)
     */
    setShellCount(count) {
        this.shellCount = Math.max(8, Math.min(32, Math.floor(count)));
        this.clearShells();
    }

    /**
     * Get current shell count
     */
    getShellCount() {
        return this.shellCount;
    }

    /**
     * Set the spacing between shell layers
     * @param {number} spacing - Distance between shells
     */
    setShellSpacing(spacing) {
        this.shellSpacing = Math.max(0.001, spacing);
        this.clearShells();
    }

    /**
     * Get current shell spacing
     */
    getShellSpacing() {
        return this.shellSpacing;
    }

    /**
     * Set maximum shell distance
     * @param {number} distance - Maximum distance for outermost shell
     */
    setMaxShellDistance(distance) {
        this.maxShellDistance = Math.max(0.01, distance);
        this.clearShells();
    }

    /**
     * Get maximum shell distance
     */
    getMaxShellDistance() {
        return this.maxShellDistance;
    }

    /**
     * Set tapering enabled/disabled
     * @param {boolean} enabled - Enable/disable tapering
     */
    setTaperingEnabled(enabled) {
        this.taperingEnabled = enabled;
        this.clearShells();
    }

    /**
     * Get tapering enabled status
     */
    getTaperingEnabled() {
        return this.taperingEnabled;
    }

    /**
     * Set tapering intensity
     * @param {number} intensity - Tapering intensity (0.0 to 1.0)
     */
    setTaperingIntensity(intensity) {
        this.taperingIntensity = Math.max(0.0, Math.min(1.0, intensity));
        this.clearShells();
    }

    /**
     * Get tapering intensity
     */
    getTaperingIntensity() {
        return this.taperingIntensity;
    }

    /**
     * Set tapering curve type
     * @param {string} curve - Curve type: 'linear', 'quadratic', 'exponential'
     */
    setTaperingCurve(curve) {
        const validCurves = ['linear', 'quadratic', 'exponential'];
        if (validCurves.includes(curve)) {
            this.taperingCurve = curve;
            this.clearShells();
        }
    }

    /**
     * Get tapering curve type
     */
    getTaperingCurve() {
        return this.taperingCurve;
    }

    /**
     * Set tapering method
     * @param {string} method - Scaling method: 'centroid', 'normal', 'hybrid'
     */
    setTaperingMethod(method) {
        const validMethods = ['centroid', 'normal', 'hybrid'];
        if (validMethods.includes(method)) {
            this.taperingMethod = method;
            this.clearShells();
        }
    }

    /**
     * Get tapering method
     */
    getTaperingMethod() {
        return this.taperingMethod;
    }

    /**
     * Generate shell geometries for the given base mesh
     * Creates offset copies of the mesh geometry displaced along surface normals
     * @param {THREE.Mesh} baseMesh - The base mesh to generate shells for
     * @returns {Array<THREE.BufferGeometry>} Array of shell geometries
     */
    generateShells(baseMesh) {
        if (!baseMesh || !baseMesh.geometry) {
            console.warn('ShellGeometry: Invalid base mesh provided');
            return [];
        }

        // Clear existing shells
        this.clearShells();

        // Store reference to base geometry
        this.baseGeometry = baseMesh.geometry;

        // Ensure geometry has normals
        if (!this.baseGeometry.attributes.normal) {
            this.baseGeometry.computeVertexNormals();
        }

        // Always use full shell count (no LOD)
        const effectiveShellCount = this.shellCount;

        // Check geometry pool for reusable geometries
        const poolKey = this.generatePoolKey(baseMesh.geometry, effectiveShellCount);
        if (this.geometryPool.has(poolKey)) {
            this.shellGeometries = this.geometryPool.get(poolKey);
            console.log(`Reused ${this.shellGeometries.length} shell layers from pool`);
            return this.shellGeometries;
        }

        // Generate shell layers from innermost to outermost
        for (let i = 1; i <= effectiveShellCount; i++) {
            const shellGeometry = this.createShellLayer(i, effectiveShellCount);
            if (shellGeometry) {
                this.shellGeometries.push(shellGeometry);
            }
        }

        // Cache geometries in pool for reuse
        this.addToGeometryPool(poolKey, this.shellGeometries);

        console.log(`Generated ${this.shellGeometries.length} shell layers`);
        return this.shellGeometries;
    }

    /**
     * Generate a unique key for geometry pooling with geometric isolation
     * @param {THREE.BufferGeometry} geometry - Base geometry
     * @param {number} shellCount - Number of shells
     * @returns {string} Pool key
     */
    generatePoolKey(geometry, shellCount) {
        const vertexCount = geometry.attributes.position.count;
        const geometryId = geometry.uuid || 'unknown';
        const isolationFlag = 'isolated'; // Mark as using geometric isolation
        return `${geometryId}_${vertexCount}_${shellCount}_${this.shellSpacing}_${this.maxShellDistance}_${this.taperingEnabled}_${this.taperingIntensity}_${this.taperingCurve}_${this.taperingMethod}_${isolationFlag}`;
    }

    /**
     * Add geometries to the pool for reuse
     * @param {string} key - Pool key
     * @param {Array<THREE.BufferGeometry>} geometries - Geometries to cache
     */
    addToGeometryPool(key, geometries) {
        // Manage pool size to prevent memory leaks
        if (this.geometryPool.size >= this.maxPoolSize) {
            // Remove oldest entry
            const firstKey = this.geometryPool.keys().next().value;
            const oldGeometries = this.geometryPool.get(firstKey);
            oldGeometries.forEach(geo => geo.dispose());
            this.geometryPool.delete(firstKey);
        }

        // Clone geometries for pool storage
        const clonedGeometries = geometries.map(geo => geo.clone());
        this.geometryPool.set(key, clonedGeometries);
    }

    /**
     * Create a single shell layer at the specified offset with completely independent vertices
     * @param {number} layerIndex - Shell layer index (1-based)
     * @param {number} totalShells - Total number of shells (for LOD)
     * @returns {THREE.BufferGeometry} Shell geometry for this layer
     */
    createShellLayer(layerIndex, totalShells = this.shellCount) {
        if (!this.baseGeometry) {
            console.warn('ShellGeometry: No base geometry available');
            return null;
        }

        // Calculate offset distance for this shell layer
        // Use progressive spacing that can be either linear or non-linear
        const normalizedLayer = layerIndex / totalShells;

        // Option 1: Linear spacing
        let offsetDistance = normalizedLayer * this.maxShellDistance;

        // Option 2: Non-linear spacing for better fur volume distribution
        // Outer shells get more spacing for better visual effect
        const nonLinearFactor = Math.pow(normalizedLayer, 1.2);
        offsetDistance = nonLinearFactor * this.maxShellDistance;

        // Create completely independent geometry with duplicated vertices
        const shellGeometry = this.createIndependentGeometry();

        if (!shellGeometry) {
            console.warn('ShellGeometry: Failed to create independent geometry');
            return null;
        }

        // Get vertex positions and normals from the new independent geometry
        const positions = shellGeometry.attributes.position;
        const normals = shellGeometry.attributes.normal;

        // Add face-based randomized normals for wind variation
        this.addRandomizedNormals(shellGeometry, layerIndex, totalShells);

        // Process vertices with geometric isolation
        this.processVerticesWithGeometricIsolation(positions, normals, offsetDistance, layerIndex, totalShells);

        // Recompute bounding sphere for proper culling
        shellGeometry.computeBoundingSphere();

        // Add custom attributes for shell rendering
        shellGeometry.userData = {
            shellLayer: layerIndex,
            shellCount: totalShells,
            offsetDistance: offsetDistance,
            normalizedLayer: normalizedLayer,
            geometricallyIsolated: true // Mark as having independent vertices
        };

        return shellGeometry;
    }

    /**
     * Create completely independent geometry with duplicated vertices for geometric isolation
     * @returns {THREE.BufferGeometry|null} New geometry with independent vertex sets
     */
    createIndependentGeometry() {
        if (!this.baseGeometry) {
            return null;
        }

        // Create a new empty geometry
        const independentGeometry = new THREE.BufferGeometry();

        // Get base geometry attributes
        const basePositions = this.baseGeometry.attributes.position;
        const baseNormals = this.baseGeometry.attributes.normal;
        const baseUvs = this.baseGeometry.attributes.uv;
        const baseIndex = this.baseGeometry.index;

        if (!basePositions || !baseNormals) {
            console.warn('ShellGeometry: Base geometry missing required attributes');
            return null;
        }

        let newPositions, newNormals, newUvs;

        if (baseIndex) {
            // Handle indexed geometry - duplicate vertices for each face
            const indexArray = baseIndex.array;
            const faceCount = indexArray.length / 3;
            const newVertexCount = faceCount * 3; // 3 vertices per face

            // Create new attribute arrays
            newPositions = new Float32Array(newVertexCount * 3);
            newNormals = new Float32Array(newVertexCount * 3);
            if (baseUvs) {
                newUvs = new Float32Array(newVertexCount * 2);
            }

            // Duplicate vertices for each face to ensure complete independence
            for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
                const i0 = indexArray[faceIndex * 3];
                const i1 = indexArray[faceIndex * 3 + 1];
                const i2 = indexArray[faceIndex * 3 + 2];

                // Copy vertex data for each face vertex
                for (let v = 0; v < 3; v++) {
                    const srcIndex = indexArray[faceIndex * 3 + v];
                    const dstIndex = faceIndex * 3 + v;

                    // Copy position
                    newPositions[dstIndex * 3] = basePositions.array[srcIndex * 3];
                    newPositions[dstIndex * 3 + 1] = basePositions.array[srcIndex * 3 + 1];
                    newPositions[dstIndex * 3 + 2] = basePositions.array[srcIndex * 3 + 2];

                    // Copy normal
                    newNormals[dstIndex * 3] = baseNormals.array[srcIndex * 3];
                    newNormals[dstIndex * 3 + 1] = baseNormals.array[srcIndex * 3 + 1];
                    newNormals[dstIndex * 3 + 2] = baseNormals.array[srcIndex * 3 + 2];

                    // Copy UV if available
                    if (baseUvs && newUvs) {
                        newUvs[dstIndex * 2] = baseUvs.array[srcIndex * 2];
                        newUvs[dstIndex * 2 + 1] = baseUvs.array[srcIndex * 2 + 1];
                    }
                }
            }
        } else {
            // Handle non-indexed geometry - already has independent vertices per face
            const vertexCount = basePositions.count;

            // Create new attribute arrays by copying existing data
            newPositions = new Float32Array(basePositions.array);
            newNormals = new Float32Array(baseNormals.array);
            if (baseUvs) {
                newUvs = new Float32Array(baseUvs.array);
            }
        }

        // Set attributes on the new geometry
        independentGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
        independentGeometry.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
        if (newUvs) {
            independentGeometry.setAttribute('uv', new THREE.BufferAttribute(newUvs, 2));
        }

        // No index needed since we have independent vertices
        // This ensures each triangle is completely separate

        return independentGeometry;
    }

    /**
     * Add face-based randomized normals for wind variation
     * Creates consistent random normal offsets per face for natural fur growth direction variation
     * @param {THREE.BufferGeometry} geometry - Shell geometry to modify
     * @param {number} layerIndex - Current shell layer index (1-based)
     * @param {number} totalShells - Total number of shells
     */
    addRandomizedNormals(geometry, layerIndex, totalShells) {
        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;

        if (!positions || !normals) {
            console.warn('ShellGeometry: Missing position or normal attributes for randomization');
            return;
        }

        const positionArray = positions.array;
        const normalArray = normals.array;
        const vertexCount = positionArray.length / 3;
        const faceCount = vertexCount / 3; // Each face has 3 vertices

        // Create randomized normals attribute
        const randomizedNormals = new Float32Array(normalArray.length);

        // Process each face separately to ensure consistent randomness per face
        for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
            const baseIndex = faceIndex * 9; // 3 vertices * 3 components

            // Calculate face centroid for consistent random seed
            const centroidX = (positionArray[baseIndex] + positionArray[baseIndex + 3] + positionArray[baseIndex + 6]) / 3;
            const centroidY = (positionArray[baseIndex + 1] + positionArray[baseIndex + 4] + positionArray[baseIndex + 7]) / 3;
            const centroidZ = (positionArray[baseIndex + 2] + positionArray[baseIndex + 5] + positionArray[baseIndex + 8]) / 3;

            // Generate consistent random offset for this face based on centroid position
            const seed = centroidX * 12.9898 + centroidY * 78.233 + centroidZ * 37.719;
            const random1 = this.fract(Math.sin(seed) * 43758.5453);
            const random2 = this.fract(Math.sin(seed * 1.1) * 43758.5453);
            const random3 = this.fract(Math.sin(seed * 1.3) * 43758.5453);

            // Convert to [-1, 1] range for directional offsets
            const randomOffsetX = (random1 * 2.0 - 1.0) * 0.3; // Scale factor for randomness intensity
            const randomOffsetY = (random2 * 2.0 - 1.0) * 0.3;
            const randomOffsetZ = (random3 * 2.0 - 1.0) * 0.3;

            // Apply the same random normal offset to all vertices of this face
            for (let v = 0; v < 3; v++) {
                const vIndex = baseIndex + v * 3;

                // Get original normal
                const nx = normalArray[vIndex];
                const ny = normalArray[vIndex + 1];
                const nz = normalArray[vIndex + 2];

                // Add random offset to normal direction
                let randomizedNx = nx + randomOffsetX;
                let randomizedNy = ny + randomOffsetY;
                let randomizedNz = nz + randomOffsetZ;

                // Normalize the randomized normal
                const length = Math.sqrt(randomizedNx * randomizedNx + randomizedNy * randomizedNy + randomizedNz * randomizedNz);
                if (length > 0) {
                    randomizedNx /= length;
                    randomizedNy /= length;
                    randomizedNz /= length;
                }

                // Store randomized normal
                randomizedNormals[vIndex] = randomizedNx;
                randomizedNormals[vIndex + 1] = randomizedNy;
                randomizedNormals[vIndex + 2] = randomizedNz;
            }
        }

        // Add randomized normals as a new attribute
        geometry.setAttribute('randomizedNormal', new THREE.BufferAttribute(randomizedNormals, 3));
    }

    /**
     * Fractional part function for consistent random number generation
     * @param {number} value - Input value
     * @returns {number} Fractional part
     */
    fract(value) {
        return value - Math.floor(value);
    }

    /**
     * Process vertices with geometric isolation for shell displacement and tapering
     * @param {THREE.BufferAttribute} positions - Position attribute
     * @param {THREE.BufferAttribute} normals - Normal attribute
     * @param {number} offsetDistance - Displacement distance
     * @param {number} layerIndex - Current shell layer index (1-based)
     * @param {number} totalShells - Total number of shells
     */
    processVerticesWithGeometricIsolation(positions, normals, offsetDistance, layerIndex, totalShells) {
        const positionArray = positions.array;
        const normalArray = normals.array;

        // Calculate tapering scale factor for this layer
        const normalizedLayer = layerIndex / totalShells;
        const taperingScale = this.calculateTaperingScale(normalizedLayer);

        // Since we have independent vertices, process each face separately
        const vertexCount = positionArray.length / 3;
        const faceCount = vertexCount / 3; // Each face has 3 vertices

        for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
            this.processIndependentFace(positionArray, normalArray, faceIndex, offsetDistance, taperingScale);
        }

        // Mark attributes as needing update
        positions.needsUpdate = true;
        normals.needsUpdate = true;
    }

    /**
     * Process a single independent face with displacement and tapering
     * @param {Float32Array} positionArray - Position array
     * @param {Float32Array} normalArray - Normal array
     * @param {number} faceIndex - Face index
     * @param {number} offsetDistance - Displacement distance
     * @param {number} taperingScale - Tapering scale factor
     */
    processIndependentFace(positionArray, normalArray, faceIndex, offsetDistance, taperingScale) {
        const baseIndex = faceIndex * 9; // 3 vertices * 3 components

        // Get the three vertices of this face
        const vertices = [];
        for (let v = 0; v < 3; v++) {
            const vIndex = baseIndex + v * 3;
            vertices.push({
                x: positionArray[vIndex],
                y: positionArray[vIndex + 1],
                z: positionArray[vIndex + 2],
                nx: normalArray[vIndex],
                ny: normalArray[vIndex + 1],
                nz: normalArray[vIndex + 2]
            });
        }

        // Apply normal displacement first
        for (let v = 0; v < 3; v++) {
            vertices[v].x += vertices[v].nx * offsetDistance;
            vertices[v].y += vertices[v].ny * offsetDistance;
            vertices[v].z += vertices[v].nz * offsetDistance;
        }

        // Apply tapering if enabled
        if (this.taperingEnabled && taperingScale < 1.0) {
            // Calculate face centroid
            const centroid = {
                x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
                y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3,
                z: (vertices[0].z + vertices[1].z + vertices[2].z) / 3
            };

            // Apply tapering to each vertex
            for (let v = 0; v < 3; v++) {
                const taperedVertex = this.applyGeometricIsolationTapering(vertices[v], centroid, taperingScale);
                vertices[v].x = taperedVertex.x;
                vertices[v].y = taperedVertex.y;
                vertices[v].z = taperedVertex.z;
            }
        }

        // Write back the processed vertices
        for (let v = 0; v < 3; v++) {
            const vIndex = baseIndex + v * 3;
            positionArray[vIndex] = vertices[v].x;
            positionArray[vIndex + 1] = vertices[v].y;
            positionArray[vIndex + 2] = vertices[v].z;
        }
    }

    /**
     * Apply geometric isolation tapering to a vertex
     * @param {Object} vertex - Vertex with position {x, y, z}
     * @param {Object} centroid - Face centroid {x, y, z}
     * @param {number} scale - Scale factor (0.0 to 1.0)
     * @returns {Object} Tapered vertex position
     */
    applyGeometricIsolationTapering(vertex, centroid, scale) {
        if (scale >= 1.0) {
            return { x: vertex.x, y: vertex.y, z: vertex.z };
        }

        // Calculate vector from centroid to vertex
        const toVertex = {
            x: vertex.x - centroid.x,
            y: vertex.y - centroid.y,
            z: vertex.z - centroid.z
        };

        // Scale the face by scaling the distance from centroid to vertex
        // This creates true geometric separation between shell layers
        return {
            x: centroid.x + toVertex.x * scale,
            y: centroid.y + toVertex.y * scale,
            z: centroid.z + toVertex.z * scale
        };
    }

    /**
     * Optimized vertex processing for shell displacement with true geometric tapering
     * @param {THREE.BufferAttribute} positions - Position attribute
     * @param {THREE.BufferAttribute} normals - Normal attribute
     * @param {number} offsetDistance - Displacement distance
     * @param {number} layerIndex - Current shell layer index (1-based)
     * @param {number} totalShells - Total number of shells
     */
    processVerticesOptimized(positions, normals, offsetDistance, layerIndex, totalShells) {
        const positionArray = positions.array;
        const normalArray = normals.array;

        // Calculate tapering scale factor for this layer
        const normalizedLayer = layerIndex / totalShells;
        const taperingScale = this.calculateTaperingScale(normalizedLayer);

        // Check if geometry is indexed or non-indexed
        const indexAttribute = this.baseGeometry.index;

        if (this.taperingEnabled && taperingScale < 1.0) {
            // Use proper face-based processing for tapering
            this.processFaceBasedTapering(positionArray, normalArray, offsetDistance, taperingScale, indexAttribute);
        } else {
            // Simple vertex displacement without tapering
            this.processSimpleDisplacement(positionArray, normalArray, offsetDistance);
        }

        // Mark position attribute as needing update
        positions.needsUpdate = true;
    }

    /**
     * Process vertices with simple normal displacement (no tapering)
     * @param {Float32Array} positionArray - Position array
     * @param {Float32Array} normalArray - Normal array
     * @param {number} offsetDistance - Displacement distance
     */
    processSimpleDisplacement(positionArray, normalArray, offsetDistance) {
        const vertexCount = positionArray.length;

        for (let i = 0; i < vertexCount; i += 3) {
            // Get vertex position and normal
            const x = positionArray[i];
            const y = positionArray[i + 1];
            const z = positionArray[i + 2];

            const nx = normalArray[i];
            const ny = normalArray[i + 1];
            const nz = normalArray[i + 2];

            // Apply normal displacement
            positionArray[i] = x + nx * offsetDistance;
            positionArray[i + 1] = y + ny * offsetDistance;
            positionArray[i + 2] = z + nz * offsetDistance;
        }
    }

    /**
     * Process vertices with proper face-based tapering
     * @param {Float32Array} positionArray - Position array
     * @param {Float32Array} normalArray - Normal array
     * @param {number} offsetDistance - Displacement distance
     * @param {number} taperingScale - Tapering scale factor
     * @param {THREE.BufferAttribute|null} indexAttribute - Index attribute (null for non-indexed)
     */
    processFaceBasedTapering(positionArray, normalArray, offsetDistance, taperingScale, indexAttribute) {
        // First apply normal displacement to all vertices
        this.processSimpleDisplacement(positionArray, normalArray, offsetDistance);

        // Then apply face-based tapering
        if (indexAttribute) {
            // Handle indexed geometry
            this.processIndexedGeometryTapering(positionArray, taperingScale, indexAttribute);
        } else {
            // Handle non-indexed geometry
            this.processNonIndexedGeometryTapering(positionArray, taperingScale);
        }
    }

    /**
     * Process tapering for indexed geometry
     * @param {Float32Array} positionArray - Position array
     * @param {number} taperingScale - Tapering scale factor
     * @param {THREE.BufferAttribute} indexAttribute - Index attribute
     */
    processIndexedGeometryTapering(positionArray, taperingScale, indexAttribute) {
        const indexArray = indexAttribute.array;
        const faceCount = indexArray.length / 3;

        // Process each face individually
        for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
            const i0 = indexArray[faceIndex * 3];
            const i1 = indexArray[faceIndex * 3 + 1];
            const i2 = indexArray[faceIndex * 3 + 2];

            // Get the three vertices of this face
            const v0 = {
                x: positionArray[i0 * 3],
                y: positionArray[i0 * 3 + 1],
                z: positionArray[i0 * 3 + 2]
            };
            const v1 = {
                x: positionArray[i1 * 3],
                y: positionArray[i1 * 3 + 1],
                z: positionArray[i1 * 3 + 2]
            };
            const v2 = {
                x: positionArray[i2 * 3],
                y: positionArray[i2 * 3 + 1],
                z: positionArray[i2 * 3 + 2]
            };

            // Calculate face centroid
            const centroid = {
                x: (v0.x + v1.x + v2.x) / 3,
                y: (v0.y + v1.y + v2.y) / 3,
                z: (v0.z + v1.z + v2.z) / 3
            };

            // Apply tapering to each vertex of this face
            const taperedV0 = this.applyTrueGeometricTaperingToVertex(v0, centroid, taperingScale);
            const taperedV1 = this.applyTrueGeometricTaperingToVertex(v1, centroid, taperingScale);
            const taperedV2 = this.applyTrueGeometricTaperingToVertex(v2, centroid, taperingScale);

            // Update vertex positions
            positionArray[i0 * 3] = taperedV0.x;
            positionArray[i0 * 3 + 1] = taperedV0.y;
            positionArray[i0 * 3 + 2] = taperedV0.z;

            positionArray[i1 * 3] = taperedV1.x;
            positionArray[i1 * 3 + 1] = taperedV1.y;
            positionArray[i1 * 3 + 2] = taperedV1.z;

            positionArray[i2 * 3] = taperedV2.x;
            positionArray[i2 * 3 + 1] = taperedV2.y;
            positionArray[i2 * 3 + 2] = taperedV2.z;
        }
    }

    /**
     * Process tapering for non-indexed geometry
     * @param {Float32Array} positionArray - Position array
     * @param {number} taperingScale - Tapering scale factor
     */
    processNonIndexedGeometryTapering(positionArray, taperingScale) {
        const vertexCount = positionArray.length / 3;
        const faceCount = vertexCount / 3;

        // Process each face (3 consecutive vertices)
        for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
            const baseIndex = faceIndex * 9; // 3 vertices * 3 components

            // Get the three vertices of this face
            const v0 = {
                x: positionArray[baseIndex],
                y: positionArray[baseIndex + 1],
                z: positionArray[baseIndex + 2]
            };
            const v1 = {
                x: positionArray[baseIndex + 3],
                y: positionArray[baseIndex + 4],
                z: positionArray[baseIndex + 5]
            };
            const v2 = {
                x: positionArray[baseIndex + 6],
                y: positionArray[baseIndex + 7],
                z: positionArray[baseIndex + 8]
            };

            // Calculate face centroid
            const centroid = {
                x: (v0.x + v1.x + v2.x) / 3,
                y: (v0.y + v1.y + v2.y) / 3,
                z: (v0.z + v1.z + v2.z) / 3
            };

            // Apply tapering to each vertex of this face
            const taperedV0 = this.applyTrueGeometricTaperingToVertex(v0, centroid, taperingScale);
            const taperedV1 = this.applyTrueGeometricTaperingToVertex(v1, centroid, taperingScale);
            const taperedV2 = this.applyTrueGeometricTaperingToVertex(v2, centroid, taperingScale);

            // Update vertex positions
            positionArray[baseIndex] = taperedV0.x;
            positionArray[baseIndex + 1] = taperedV0.y;
            positionArray[baseIndex + 2] = taperedV0.z;

            positionArray[baseIndex + 3] = taperedV1.x;
            positionArray[baseIndex + 4] = taperedV1.y;
            positionArray[baseIndex + 5] = taperedV1.z;

            positionArray[baseIndex + 6] = taperedV2.x;
            positionArray[baseIndex + 7] = taperedV2.y;
            positionArray[baseIndex + 8] = taperedV2.z;
        }
    }

    /**
     * Apply true geometric tapering to a single vertex
     * @param {Object} vertex - Vertex position {x, y, z}
     * @param {Object} centroid - Face centroid {x, y, z}
     * @param {number} scale - Scale factor (0.0 to 1.0)
     * @returns {Object} Tapered vertex position
     */
    applyTrueGeometricTaperingToVertex(vertex, centroid, scale) {
        if (scale >= 1.0) {
            return vertex;
        }

        // Calculate vector from centroid to vertex
        const toVertex = {
            x: vertex.x - centroid.x,
            y: vertex.y - centroid.y,
            z: vertex.z - centroid.z
        };

        // Scale the face by scaling the distance from centroid to vertex
        return {
            x: centroid.x + toVertex.x * scale,
            y: centroid.y + toVertex.y * scale,
            z: centroid.z + toVertex.z * scale
        };
    }

    /**
     * Calculate tapering scale factor based on layer position and curve type
     * @param {number} normalizedLayer - Layer position (0.0 to 1.0)
     * @returns {number} Scale factor (0.0 to 1.0)
     */
    calculateTaperingScale(normalizedLayer) {
        if (!this.taperingEnabled || this.taperingIntensity === 0.0) {
            return 1.0;
        }

        let curveFactor;
        switch (this.taperingCurve) {
            case 'linear':
                curveFactor = normalizedLayer;
                break;
            case 'quadratic':
                curveFactor = normalizedLayer * normalizedLayer;
                break;
            case 'exponential':
                curveFactor = Math.pow(normalizedLayer, 2.5);
                break;
            default:
                curveFactor = normalizedLayer * normalizedLayer; // Default to quadratic
        }

        // Apply tapering intensity
        const taperingAmount = curveFactor * this.taperingIntensity;
        return 1.0 - taperingAmount;
    }


    /**
     * Get all generated shell geometries
     * @returns {Array<THREE.BufferGeometry>} Array of shell geometries
     */
    getShellGeometries() {
        return this.shellGeometries;
    }

    /**
     * Get shell geometry for a specific layer
     * @param {number} layerIndex - Shell layer index (0-based for array access)
     * @returns {THREE.BufferGeometry|null} Shell geometry or null if not found
     */
    getShellLayer(layerIndex) {
        if (layerIndex >= 0 && layerIndex < this.shellGeometries.length) {
            return this.shellGeometries[layerIndex];
        }
        return null;
    }

    /**
     * Clear all generated shell geometries and dispose of resources
     */
    clearShells() {
        // Dispose of existing geometries
        for (const geometry of this.shellGeometries) {
            if (geometry && geometry.dispose) {
                geometry.dispose();
            }
        }

        this.shellGeometries = [];
    }

    /**
     * Clear geometry pool and dispose of cached geometries
     */
    clearGeometryPool() {
        for (const [key, geometries] of this.geometryPool) {
            geometries.forEach(geo => {
                if (geo && geo.dispose) {
                    geo.dispose();
                }
            });
        }
        this.geometryPool.clear();
        console.log('Geometry pool cleared');
    }


    /**
     * Update shell parameters and regenerate if needed
     * @param {Object} params - Parameters to update
     * @param {THREE.Mesh} baseMesh - Base mesh to regenerate shells for
     */
    updateShells(params, baseMesh) {
        let needsRegeneration = false;

        if (params.shellCount !== undefined && params.shellCount !== this.shellCount) {
            this.setShellCount(params.shellCount);
            needsRegeneration = true;
        }

        if (params.shellSpacing !== undefined && params.shellSpacing !== this.shellSpacing) {
            this.setShellSpacing(params.shellSpacing);
            needsRegeneration = true;
        }

        if (params.maxShellDistance !== undefined && params.maxShellDistance !== this.maxShellDistance) {
            this.setMaxShellDistance(params.maxShellDistance);
            needsRegeneration = true;
        }

        // Check tapering parameters
        if (params.taperingEnabled !== undefined && params.taperingEnabled !== this.taperingEnabled) {
            this.setTaperingEnabled(params.taperingEnabled);
            needsRegeneration = true;
        }

        if (params.taperingIntensity !== undefined && params.taperingIntensity !== this.taperingIntensity) {
            this.setTaperingIntensity(params.taperingIntensity);
            needsRegeneration = true;
        }

        if (params.taperingCurve !== undefined && params.taperingCurve !== this.taperingCurve) {
            this.setTaperingCurve(params.taperingCurve);
            needsRegeneration = true;
        }

        if (params.taperingMethod !== undefined && params.taperingMethod !== this.taperingMethod) {
            this.setTaperingMethod(params.taperingMethod);
            needsRegeneration = true;
        }

        // Regenerate shells if parameters changed
        if (needsRegeneration && baseMesh) {
            return this.generateShells(baseMesh);
        }

        return this.shellGeometries;
    }

    /**
     * Get memory usage statistics for shell geometries
     * @returns {Object} Memory usage information
     */
    getMemoryUsage() {
        let totalVertices = 0;
        let totalTriangles = 0;
        let estimatedMemoryMB = 0;

        for (const geometry of this.shellGeometries) {
            if (geometry && geometry.attributes.position) {
                const vertexCount = geometry.attributes.position.count;
                const triangleCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;

                totalVertices += vertexCount;
                totalTriangles += triangleCount;

                // Estimate memory usage (position + normal + uv + indices)
                const vertexMemory = vertexCount * (3 + 3 + 2) * 4; // 4 bytes per float
                const indexMemory = triangleCount * 3 * 2; // 2 bytes per index (assuming 16-bit)
                estimatedMemoryMB += (vertexMemory + indexMemory) / (1024 * 1024);
            }
        }

        return {
            shellCount: this.shellGeometries.length,
            totalVertices,
            totalTriangles,
            estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100
        };
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.clearShells();
        this.clearGeometryPool();
        this.baseGeometry = null;
        console.log('ShellGeometry disposed with optimizations');
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance and memory usage statistics
     */
    getPerformanceStats() {
        const memoryUsage = this.getMemoryUsage();
        const poolStats = {
            poolSize: this.geometryPool.size,
            maxPoolSize: this.maxPoolSize,
            poolUtilization: (this.geometryPool.size / this.maxPoolSize * 100).toFixed(1) + '%'
        };

        return {
            ...memoryUsage,
            ...poolStats
        };
    }
}