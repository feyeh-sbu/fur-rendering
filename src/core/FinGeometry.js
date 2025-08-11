import * as THREE from 'three';

/**
 * FinGeometry - Generates and manages fin geometry for fur rendering
 * Implements fin generation as described in section 2.3 of the fur rendering paper
 */
export class FinGeometry {
    constructor() {
        this.finMeshes = [];
        this.finLength = 0.1;
        this.finWidth = 0.02;
        this.edgeThreshold = 0.5; // Threshold for edge detection

        // Performance control
        this.maxFinCount = 2500; // Default fin count (1000-50000 range)

        // Fin tapering parameters (similar to shell tapering)
        this.taperingEnabled = true; // Enable/disable fin tapering
        this.taperingIntensity = 0.7; // Tapering intensity (0.0 = no tapering, 1.0 = maximum tapering)
        this.taperingCurve = 'quadratic'; // Tapering curve type: 'linear', 'quadratic', 'exponential'
        this.taperingMethod = 'hybrid'; // Scaling method: 'centroid', 'normal', 'hybrid'
    }

    /**
     * Generate fin geometry from a base mesh
     * Creates quadrilateral fins attached to mesh edges extending along surface normals
     */
    generateFins(baseMesh) {
        this.clearFins();

        if (!baseMesh || !baseMesh.geometry) {
            console.warn('Invalid mesh provided to FinGeometry');
            return [];
        }

        const geometry = baseMesh.geometry;
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        const indices = geometry.index ? geometry.index.array : null;

        // Extract edges from the mesh
        const edges = this.extractEdges(geometry);

        // Generate fin geometry for each edge
        const finGeometries = [];

        for (const edge of edges) {
            const finGeometry = this.createFinFromEdge(edge, positions, normals);
            if (finGeometry) {
                finGeometries.push(finGeometry);
            }
        }

        console.log(`Generated ${finGeometries.length} fins from ${edges.length} edges`);
        return finGeometries;
    }

    /**
     * Extract edges from mesh geometry
     * Returns array of edge objects with vertex indices and positions
     */
    extractEdges(geometry) {
        const edges = [];
        const positions = geometry.attributes.position.array;
        const indices = geometry.index ? geometry.index.array : null;

        if (!indices) {
            // Non-indexed geometry - create edges from triangles
            for (let i = 0; i < positions.length; i += 9) {
                // Each triangle has 3 vertices, each vertex has 3 components (x,y,z)
                const v0 = i / 3;
                const v1 = v0 + 1;
                const v2 = v0 + 2;

                // Add the three edges of the triangle
                edges.push({ v0, v1 });
                edges.push({ v1, v2 });
                edges.push({ v2, v0 });
            }
        } else {
            // Indexed geometry - extract edges from triangles
            for (let i = 0; i < indices.length; i += 3) {
                const v0 = indices[i];
                const v1 = indices[i + 1];
                const v2 = indices[i + 2];

                // Add the three edges of the triangle
                edges.push({ v0, v1 });
                edges.push({ v1, v2 });
                edges.push({ v2, v0 });
            }
        }

        // Remove duplicate edges and filter based on edge criteria
        return this.filterUniqueEdges(edges);
    }

    /**
     * Filter and remove duplicate edges with configurable fin count limit
     */
    filterUniqueEdges(edges) {
        const edgeMap = new Map();
        const uniqueEdges = [];

        for (const edge of edges) {
            // Create a consistent key for the edge (smaller index first)
            const key = edge.v0 < edge.v1 ? `${edge.v0}-${edge.v1}` : `${edge.v1}-${edge.v0}`;

            if (!edgeMap.has(key)) {
                edgeMap.set(key, true);
                uniqueEdges.push(edge);
            }
        }

        // Apply configurable fin count limit for performance control
        if (uniqueEdges.length > this.maxFinCount) {
            const step = Math.floor(uniqueEdges.length / this.maxFinCount);
            return uniqueEdges.filter((_, index) => index % step === 0);
        }

        return uniqueEdges;
    }

    /**
     * Create fin geometry from an edge
     * Generates a tapered fin extending along surface normal
     */
    createFinFromEdge(edge, positions, normals) {
        const { v0, v1 } = edge;

        // Get vertex positions
        const p0 = new THREE.Vector3(
            positions[v0 * 3],
            positions[v0 * 3 + 1],
            positions[v0 * 3 + 2]
        );
        const p1 = new THREE.Vector3(
            positions[v1 * 3],
            positions[v1 * 3 + 1],
            positions[v1 * 3 + 2]
        );

        // Get vertex normals
        const n0 = new THREE.Vector3(
            normals[v0 * 3],
            normals[v0 * 3 + 1],
            normals[v0 * 3 + 2]
        ).normalize();
        const n1 = new THREE.Vector3(
            normals[v1 * 3],
            normals[v1 * 3 + 1],
            normals[v1 * 3 + 2]
        ).normalize();

        // Calculate average normal for the fin
        const avgNormal = new THREE.Vector3()
            .addVectors(n0, n1)
            .normalize();

        // Create fin vertices
        // Base vertices (on the mesh surface) - full width
        const base0 = p0.clone();
        const base1 = p1.clone();

        // Calculate top vertices with tapering
        const topScale = this.calculateTaperingScale(1.0); // At the tip (normalized position = 1.0)

        // Calculate the edge vector and its midpoint for tapering
        const edgeVector = new THREE.Vector3().subVectors(p1, p0);
        const edgeMidpoint = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);

        // Calculate top positions along normal
        const topMidpoint = edgeMidpoint.clone().add(avgNormal.clone().multiplyScalar(this.finLength));

        // Apply tapering to create narrower top vertices
        let top0, top1;

        if (this.taperingEnabled && topScale < 1.0) {
            // Calculate tapered top vertices
            const scaledEdgeVector = edgeVector.clone().multiplyScalar(topScale * 0.5);
            top0 = topMidpoint.clone().sub(scaledEdgeVector);
            top1 = topMidpoint.clone().add(scaledEdgeVector);
        } else {
            // No tapering - rectangular fin
            top0 = p0.clone().add(avgNormal.clone().multiplyScalar(this.finLength));
            top1 = p1.clone().add(avgNormal.clone().multiplyScalar(this.finLength));
        }

        // Create fin geometry
        const finGeometry = new THREE.BufferGeometry();

        // Vertices for a tapered quad (two triangles)
        const vertices = new Float32Array([
            // First triangle
            base0.x, base0.y, base0.z,
            base1.x, base1.y, base1.z,
            top0.x, top0.y, top0.z,

            // Second triangle
            base1.x, base1.y, base1.z,
            top1.x, top1.y, top1.z,
            top0.x, top0.y, top0.z
        ]);

        // Calculate normals for the tapered fin
        // Use the original fin normal calculation but update for tapered geometry
        const finNormal = new THREE.Vector3()
            .subVectors(p1, p0)
            .cross(avgNormal)
            .normalize();

        const finNormals = new Float32Array([
            finNormal.x, finNormal.y, finNormal.z,
            finNormal.x, finNormal.y, finNormal.z,
            finNormal.x, finNormal.y, finNormal.z,
            finNormal.x, finNormal.y, finNormal.z,
            finNormal.x, finNormal.y, finNormal.z,
            finNormal.x, finNormal.y, finNormal.z
        ]);

        // UV coordinates for texture mapping (adjusted for tapering)
        const uvs = new Float32Array([
            0.0, 0.0,  // base0
            1.0, 0.0,  // base1
            0.25, 1.0, // top0 (tapered - closer to center)
            1.0, 0.0,  // base1
            0.75, 1.0, // top1 (tapered - closer to center)
            0.25, 1.0  // top0
        ]);

        finGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        finGeometry.setAttribute('normal', new THREE.BufferAttribute(finNormals, 3));
        finGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        // Store the fin normal and tapering info for silhouette detection
        finGeometry.userData.finNormal = finNormal.clone();
        finGeometry.userData.tapered = this.taperingEnabled;
        finGeometry.userData.taperingScale = topScale;

        return finGeometry;
    }

    /**
     * Set fin length
     */
    setFinLength(length) {
        this.finLength = Math.max(0, length);
    }

    /**
     * Get fin length
     */
    getFinLength() {
        return this.finLength;
    }

    /**
     * Set maximum fin count for performance control
     * @param {number} count - Maximum number of fins (200-2000)
     */
    setMaxFinCount(count) {
        this.maxFinCount = Math.max(200, Math.min(2000, Math.floor(count)));
    }

    /**
     * Get maximum fin count
     */
    getMaxFinCount() {
        return this.maxFinCount;
    }

    /**
     * Set fin tapering enabled/disabled
     * @param {boolean} enabled - Enable/disable tapering
     */
    setTaperingEnabled(enabled) {
        this.taperingEnabled = enabled;
    }

    /**
     * Get fin tapering enabled status
     */
    getTaperingEnabled() {
        return this.taperingEnabled;
    }

    /**
     * Set fin tapering intensity
     * @param {number} intensity - Tapering intensity (0.0 to 1.0)
     */
    setTaperingIntensity(intensity) {
        this.taperingIntensity = Math.max(0.0, Math.min(1.0, intensity));
    }

    /**
     * Get fin tapering intensity
     */
    getTaperingIntensity() {
        return this.taperingIntensity;
    }

    /**
     * Set fin tapering curve type
     * @param {string} curve - Curve type: 'linear', 'quadratic', 'exponential'
     */
    setTaperingCurve(curve) {
        const validCurves = ['linear', 'quadratic', 'exponential'];
        if (validCurves.includes(curve)) {
            this.taperingCurve = curve;
        }
    }

    /**
     * Get fin tapering curve type
     */
    getTaperingCurve() {
        return this.taperingCurve;
    }

    /**
     * Set fin tapering method
     * @param {string} method - Scaling method: 'centroid', 'normal', 'hybrid'
     */
    setTaperingMethod(method) {
        const validMethods = ['centroid', 'normal', 'hybrid'];
        if (validMethods.includes(method)) {
            this.taperingMethod = method;
        }
    }

    /**
     * Get fin tapering method
     */
    getTaperingMethod() {
        return this.taperingMethod;
    }

    /**
     * Calculate fin tapering scale factor based on position along fin length
     * @param {number} normalizedPosition - Position along fin (0.0 = base, 1.0 = tip)
     * @returns {number} Scale factor (0.0 to 1.0)
     */
    calculateTaperingScale(normalizedPosition) {
        if (!this.taperingEnabled || this.taperingIntensity === 0.0) {
            return 1.0;
        }

        let curveFactor;
        switch (this.taperingCurve) {
            case 'linear':
                curveFactor = normalizedPosition;
                break;
            case 'quadratic':
                curveFactor = normalizedPosition * normalizedPosition;
                break;
            case 'exponential':
                curveFactor = Math.pow(normalizedPosition, 2.5);
                break;
            default:
                curveFactor = normalizedPosition * normalizedPosition; // Default to quadratic
        }

        // Apply tapering intensity
        const taperingAmount = curveFactor * this.taperingIntensity;
        return 1.0 - taperingAmount;
    }

    /**
     * Clear all generated fins
     */
    clearFins() {
        for (const mesh of this.finMeshes) {
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
        }
        this.finMeshes = [];
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.clearFins();
    }
}