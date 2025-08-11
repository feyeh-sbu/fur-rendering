import * as THREE from 'three'
import { FinGeometry } from './FinGeometry.js'
import { ShellGeometry } from './ShellGeometry.js'
import { WindSimulation } from './WindSimulation.js'

/**
 * FurRenderer - Main fur rendering system
 * Implements surface rendering component as foundation for fur system
 * Follows the architectural design from FurRenderingArchitecture.md
 */
export class FurRenderer {
    constructor(renderer, scene) {
        this.renderer = renderer
        this.scene = scene

        // Check WebGL2 support
        this.isWebGL2 = this.renderer.capabilities.isWebGL2
        if (!this.isWebGL2) {
            console.warn('WebGL2 not supported, falling back to WebGL1')
        }

        // Rendering components
        this.surfaceRenderer = null
        this.finGeometry = new FinGeometry()
        this.finMeshes = []
        this.shellGeometry = new ShellGeometry()
        this.shellMeshes = []

        // Wind simulation system
        this.windSimulation = new WindSimulation()

        // Global fur parameters
        this.furColor = new THREE.Color(0xe8f7f7) // Default light cyan fur color
        this.lightDirection = new THREE.Vector3(1, 1, 1).normalize()
        this.lightIntensity = 1.0
        this.ambientColor = new THREE.Color(0x404040)

        // Fin-specific parameters
        this.finEnabled = true
        this.finLength = 0.05
        this.finOpacity = 0.5
        this.silhouetteSensitivity = 2.0
        this.maxFinCount = 5000 // Default fin count (1000-50000 range)

        // Fin tapering parameters
        this.finTaperingEnabled = true
        this.finTaperingIntensity = 0.7
        this.finTaperingCurve = 'quadratic' // 'linear', 'quadratic', 'exponential'
        this.finTaperingMethod = 'hybrid' // 'centroid', 'normal', 'hybrid'

        // Shell-specific parameters
        this.shellEnabled = true
        this.shellCount = 24
        this.shellSpacing = 0.005
        this.shellOpacity = 0.6
        this.shellDensity = 2.0
        this.shellLayerOpacity = 1.0
        this.maxShellDistance = 0.1

        // Shell tapering parameters
        this.taperingEnabled = true
        this.taperingIntensity = 0.7
        this.taperingCurve = 'quadratic' // 'linear', 'quadratic', 'exponential'
        this.taperingMethod = 'hybrid' // 'centroid', 'normal', 'hybrid'

        // Debug visualization parameters
        this.shellWireframeMode = false
        this.finWireframeMode = false

        // Current mesh being rendered
        this.currentMesh = null
        this.originalMaterial = null

        this.init()
    }

    /**
     * Initialize the fur rendering system
     */
    async init() {
        try {
            await this.createSurfaceRenderer()
            await this.createFinRenderer()
            await this.createShellRenderer()
            console.log('FurRenderer initialization complete')
        } catch (error) {
            console.error('Failed to initialize FurRenderer:', error)
            throw error
        }
    }

    /**
     * Load shader from external file
     * @param {string} url - Shader file URL
     * @returns {Promise<string>} Shader source code
     */
    async loadShader(url) {
        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Failed to load shader: ${url} (${response.status})`)
            }
            return await response.text()
        } catch (error) {
            console.error(`Error loading shader from ${url}:`, error)
            // Fallback to inline shaders if external loading fails
            return this.getFallbackShader(url)
        }
    }

    /**
     * Get fallback shader if external loading fails
     * @param {string} url - Original shader URL
     * @returns {string} Fallback shader source
     */
    getFallbackShader(url) {
        if (url.includes('surface.vert')) {
            return this.getVertexShader()
        } else if (url.includes('surface.frag')) {
            return this.getFragmentShader()
        } else if (url.includes('fin.vert')) {
            return this.getFinVertexShader()
        } else if (url.includes('fin.frag')) {
            return this.getFinFragmentShader()
        } else if (url.includes('shell.vert')) {
            return this.getShellVertexShader()
        } else if (url.includes('shell.frag')) {
            return this.getShellFragmentShader()
        }

        // Default fallback
        return `
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `
    }

    /**
     * Create surface rendering component
     * Renders opaque base mesh with proper Z-buffer setup
     */
    async createSurfaceRenderer() {
        // Load shaders from external files
        const vertexShader = await this.loadShader('./src/shaders/surface.vert')
        const fragmentShader = await this.loadShader('./src/shaders/surface.frag')

        // Create surface material with optimized shaders
        this.surfaceMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                furColor: { value: this.furColor },
                lightDirection: { value: this.lightDirection },
                lightIntensity: { value: this.lightIntensity },
                ambientColor: { value: this.ambientColor }
            },
            side: THREE.FrontSide,
            transparent: false,
            depthWrite: true,
            depthTest: true
        })

        console.log('Surface renderer initialized with optimized external shaders')
    }

    /**
     * Create fin rendering component
     * Renders semi-transparent fins with silhouette detection and Z-buffer testing
     */
    async createFinRenderer() {
        // Load fin shaders from external files
        const finVertexShader = await this.loadShader('./src/shaders/fin.vert')
        const finFragmentShader = await this.loadShader('./src/shaders/fin.frag')

        // Create fin material with alpha blending and Z-buffer testing
        this.finMaterial = new THREE.ShaderMaterial({
            vertexShader: finVertexShader,
            fragmentShader: finFragmentShader,
            uniforms: {
                furColor: { value: this.furColor },
                lightDirection: { value: this.lightDirection },
                lightIntensity: { value: this.lightIntensity },
                ambientColor: { value: this.ambientColor },
                finOpacity: { value: this.finOpacity },
                silhouetteSensitivity: { value: this.silhouetteSensitivity },
                // Wind simulation uniforms
                ...this.windSimulation.getShaderUniforms()
            },
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false, // Test but don't write to Z-buffer as per paper
            depthTest: true,
            blending: THREE.NormalBlending
        })

        console.log('Fin renderer initialized with optimized external shaders')
    }

    /**
     * Create shell rendering component
     * Renders semi-transparent shell layers with progressive alpha blending
     */
    async createShellRenderer() {
        // Load shell shaders from external files
        const shellVertexShader = await this.loadShader('./src/shaders/shell.vert')
        const shellFragmentShader = await this.loadShader('./src/shaders/shell.frag')

        // Create shell material with alpha blending and proper depth handling
        this.shellMaterial = new THREE.ShaderMaterial({
            vertexShader: shellVertexShader,
            fragmentShader: shellFragmentShader,
            uniforms: {
                furColor: { value: this.furColor },
                lightDirection: { value: this.lightDirection },
                lightIntensity: { value: this.lightIntensity },
                ambientColor: { value: this.ambientColor },
                shellLayer: { value: 0.0 },
                shellCount: { value: this.shellCount },
                shellOpacity: { value: this.shellOpacity },
                shellDensity: { value: this.shellDensity },
                shellLayerOpacity: { value: this.shellLayerOpacity },
                shellSpacing: { value: this.shellSpacing },
                maxShellDistance: { value: this.maxShellDistance },
                // Tapering uniforms
                taperingEnabled: { value: this.taperingEnabled ? 1.0 : 0.0 },
                taperingIntensity: { value: this.taperingIntensity },
                taperingCurve: { value: this.getTaperingCurveValue() },
                // Wind simulation uniforms
                ...this.windSimulation.getShaderUniforms()
            },
            side: THREE.FrontSide,
            transparent: true,
            depthWrite: true, // Write to Z-buffer for proper depth ordering
            depthTest: true,
            blending: THREE.NormalBlending
        })

        console.log('Shell renderer initialized with optimized external shaders')
    }

    /**
     * Get vertex shader source
     */
    getVertexShader() {
        return `
// Surface vertex shader for fur rendering base layer
// Renders the opaque base mesh with proper Z-buffer setup

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
    // Transform position to clip space
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Pass data to fragment shader
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vPosition = mvPosition.xyz;
}
        `
    }

    /**
     * Get fragment shader source
     */
    getFragmentShader() {
        return `
precision highp float;

// Surface fragment shader for fur rendering base layer
// Renders opaque base mesh with global color and basic lighting

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;

uniform vec3 furColor;
uniform vec3 lightDirection;
uniform float lightIntensity;
uniform vec3 ambientColor;

void main() {
    // Normalize the interpolated normal
    vec3 normal = normalize(vNormal);

    // Calculate diffuse lighting using Lambertian model
    float diffuse = max(0.0, dot(normal, normalize(lightDirection)));

    // Combine ambient and diffuse lighting
    vec3 lighting = ambientColor + (diffuse * lightIntensity);

    // Apply lighting to fur color
    vec3 finalColor = furColor * lighting;

    // Output opaque color (alpha = 1.0 for surface layer)
    gl_FragColor = vec4(finalColor, 1.0);
}
        `
    }

    /**
     * Get fin vertex shader source
     */
    getFinVertexShader() {
        return `
// Fin vertex shader for fur rendering
// Handles fin geometry transformations and passes data for silhouette detection

// Output to fragment shader
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vCameraDirection;

void main() {
    // Transform position to clip space
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Transform normal to view space for lighting calculations
    vNormal = normalize(normalMatrix * normal);

    // Transform normal to world space for silhouette detection
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    // Pass UV coordinates for texture mapping
    vUv = uv;

    // Pass view space position
    vPosition = mvPosition.xyz;
    vViewPosition = mvPosition.xyz;

    // Calculate camera direction in world space for silhouette detection
    vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 cameraWorldPosition = vec3(0.0, 0.0, 5.0); // Simple camera position for now
    vCameraDirection = normalize(cameraWorldPosition - worldPosition);
}
        `
    }

    /**
     * Get fin fragment shader source
     */
    getFinFragmentShader() {
        return `
precision highp float;

// Fin fragment shader for fur rendering
// Implements silhouette detection and alpha blending as specified in the research paper

varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vCameraDirection;

uniform vec3 furColor;
uniform vec3 lightDirection;
uniform float lightIntensity;
uniform vec3 ambientColor;
uniform float finOpacity;
uniform float silhouetteSensitivity;

void main() {
    // Normalize the interpolated normal
    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);

    // Silhouette detection using the formula from the research paper
    // Calculate dot product p between fin normal and camera direction
    float p = dot(worldNormal, vCameraDirection);

    // Apply the fade-in formula: max(0, 2|p|-1)
    // This gradually fades in fins as they approach the silhouette
    float silhouetteAlpha = max(0.0, 2.0 * abs(p) - 1.0);

    // Apply silhouette sensitivity control
    silhouetteAlpha = pow(silhouetteAlpha, silhouetteSensitivity);

    // If alpha is zero, discard the fragment (don't render this fin)
    if (silhouetteAlpha <= 0.001) {
        discard;
    }

    // Calculate diffuse lighting using Lambertian model
    float diffuse = max(0.0, dot(normal, normalize(lightDirection)));

    // Combine ambient and diffuse lighting
    vec3 lighting = ambientColor + (diffuse * lightIntensity);

    // Apply lighting to fur color
    vec3 finalColor = furColor * lighting;

    // Calculate final alpha combining silhouette detection and user opacity
    float finalAlpha = silhouetteAlpha * finOpacity;

    // Output color with alpha blending
    gl_FragColor = vec4(finalColor, finalAlpha);
}
        `
    }

    /**
     * Get shell vertex shader source
     */
    getShellVertexShader() {
        return `
// Shell vertex shader for fur rendering
// Handles shell geometry transformations and passes data for progressive alpha blending
// Implements the shell method as described in section 2.3 of the fur rendering paper

// Shell-specific uniforms
uniform float shellLayer;        // Current shell layer (0.0 to 1.0)
uniform float shellCount;        // Total number of shell layers
uniform float shellSpacing;      // Distance between shell layers
uniform float maxShellDistance;  // Maximum shell offset distance

// Output to fragment shader
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying float vShellLayer;
varying float vShellAlpha;

void main() {
    // Pass shell layer information to fragment shader
    vShellLayer = shellLayer;

    // Calculate progressive alpha based on shell layer
    // Inner shells are more opaque, outer shells are more transparent
    vShellAlpha = 1.0 - (shellLayer * 0.8); // Reduce opacity as we go outward

    // Transform position to clip space
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Transform normal to view space for lighting calculations
    vNormal = normalize(normalMatrix * normal);

    // Transform normal to world space for advanced effects
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    // Pass UV coordinates for texture mapping
    vUv = uv;

    // Pass view space position for depth-based effects
    vPosition = mvPosition.xyz;
    vViewPosition = mvPosition.xyz;

    // Calculate world position for advanced lighting
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
}
        `
    }

    /**
     * Get shell fragment shader source
     */
    getShellFragmentShader() {
        return `
precision highp float;

// Shell fragment shader for fur rendering
// Implements progressive alpha blending for shell layers
// Follows the shell method approach described in section 2.3 of the fur rendering paper

// Input from vertex shader
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying float vShellLayer;
varying float vShellAlpha;

// Uniforms
uniform vec3 furColor;
uniform vec3 lightDirection;
uniform float lightIntensity;
uniform vec3 ambientColor;

// Shell-specific uniforms
uniform float shellLayer;           // Current shell layer (0.0 to 1.0)
uniform float shellCount;           // Total number of shell layers
uniform float shellOpacity;         // Global shell opacity multiplier
uniform float shellDensity;         // Shell density/thickness control
uniform float shellLayerOpacity;    // Per-layer opacity multiplier

void main() {
    // Normalize the interpolated normal
    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);

    // Calculate diffuse lighting using Lambertian model
    float diffuse = max(0.0, dot(normal, normalize(lightDirection)));

    // Combine ambient and diffuse lighting
    vec3 lighting = ambientColor + (diffuse * lightIntensity);

    // Apply lighting to fur color
    vec3 baseColor = furColor * lighting;

    // Calculate progressive alpha for shell layers
    // Inner shells are more opaque, outer shells become progressively transparent
    float normalizedLayer = vShellLayer;

    // Progressive opacity reduction from inner to outer shells
    // Using multiple falloff functions for realistic fur volume

    // Linear falloff
    float linearFalloff = 1.0 - normalizedLayer;

    // Exponential falloff for more natural fur appearance
    float expFalloff = exp(-normalizedLayer * 2.0);

    // Quadratic falloff for smooth transition
    float quadFalloff = (1.0 - normalizedLayer) * (1.0 - normalizedLayer);

    // Combine falloff functions for optimal appearance
    float combinedFalloff = mix(linearFalloff, expFalloff, 0.6) * quadFalloff;

    // Apply shell density control
    // Higher density makes shells more opaque, lower density makes them more transparent
    float densityFactor = shellDensity;
    combinedFalloff *= densityFactor;

    // Apply global shell opacity multiplier
    float finalAlpha = combinedFalloff * shellOpacity * shellLayerOpacity;

    // Apply the pre-calculated alpha from vertex shader
    finalAlpha *= vShellAlpha;

    // Ensure alpha is within valid range
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);

    // Discard fragments that are too transparent to avoid overdraw
    if (finalAlpha < 0.01) {
        discard;
    }

    // Add subtle variation based on shell layer for visual interest
    // Outer shells can be slightly darker to simulate light absorption
    float layerDarkening = 1.0 - (normalizedLayer * 0.2);
    vec3 finalColor = baseColor * layerDarkening;

    // Optional: Add subtle noise or texture variation here
    // This could be used for more advanced fur appearance

    // Output final color with progressive alpha
    gl_FragColor = vec4(finalColor, finalAlpha);
}
        `
    }

    /**
     * Set the mesh to be rendered with fur
     */
    setMesh(mesh) {
        if (this.currentMesh) {
            // Restore original material
            if (this.originalMaterial) {
                this.currentMesh.material = this.originalMaterial
            }
            // Clear existing fins and shells
            this.clearFins()
            this.clearShells()
        }

        this.currentMesh = mesh
        if (mesh) {
            // Store original material
            this.originalMaterial = mesh.material

            // Apply fur surface material
            mesh.material = this.surfaceMaterial

            // Generate fins if enabled
            if (this.finEnabled) {
                this.generateFins()
            }

            // Generate shells if enabled
            if (this.shellEnabled) {
                this.generateShells()
            }

            console.log('Fur renderer applied to mesh')
        }
    }

    /**
     * Update global fur color
     */
    setFurColor(color) {
        if (color instanceof THREE.Color) {
            this.furColor.copy(color)
        } else {
            this.furColor.set(color)
        }

        if (this.surfaceMaterial) {
            this.surfaceMaterial.uniforms.furColor.value = this.furColor
        }
        if (this.finMaterial) {
            this.finMaterial.uniforms.furColor.value = this.furColor
        }
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.furColor.value = this.furColor
        }

        // Update all existing shell meshes with the new fur color
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.furColor) {
                shellMesh.material.uniforms.furColor.value = this.furColor
            }
        }

        // Update all existing fin meshes with the new fur color
        for (const finMesh of this.finMeshes) {
            if (finMesh.material && finMesh.material.uniforms.furColor) {
                finMesh.material.uniforms.furColor.value = this.furColor
            }
        }
    }

    /**
     * Get current fur color
     */
    getFurColor() {
        return this.furColor
    }

    /**
     * Update light direction
     */
    setLightDirection(direction) {
        this.lightDirection.copy(direction).normalize()
        if (this.surfaceMaterial) {
            this.surfaceMaterial.uniforms.lightDirection.value = this.lightDirection
        }
        if (this.finMaterial) {
            this.finMaterial.uniforms.lightDirection.value = this.lightDirection
        }
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.lightDirection.value = this.lightDirection
        }

        // Update all existing fin meshes
        for (const finMesh of this.finMeshes) {
            if (finMesh.material && finMesh.material.uniforms.lightDirection) {
                finMesh.material.uniforms.lightDirection.value = this.lightDirection
            }
        }

        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.lightDirection) {
                shellMesh.material.uniforms.lightDirection.value = this.lightDirection
            }
        }
    }

    /**
     * Update light intensity
     */
    setLightIntensity(intensity) {
        this.lightIntensity = intensity
        if (this.surfaceMaterial) {
            this.surfaceMaterial.uniforms.lightIntensity.value = this.lightIntensity
        }
        if (this.finMaterial) {
            this.finMaterial.uniforms.lightIntensity.value = this.lightIntensity
        }
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.lightIntensity.value = this.lightIntensity
        }

        // Update all existing fin meshes
        for (const finMesh of this.finMeshes) {
            if (finMesh.material && finMesh.material.uniforms.lightIntensity) {
                finMesh.material.uniforms.lightIntensity.value = this.lightIntensity
            }
        }

        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.lightIntensity) {
                shellMesh.material.uniforms.lightIntensity.value = this.lightIntensity
            }
        }
    }

    /**
     * Update ambient color
     */
    setAmbientColor(color) {
        if (color instanceof THREE.Color) {
            this.ambientColor.copy(color)
        } else {
            this.ambientColor.set(color)
        }

        if (this.surfaceMaterial) {
            this.surfaceMaterial.uniforms.ambientColor.value = this.ambientColor
        }
        if (this.finMaterial) {
            this.finMaterial.uniforms.ambientColor.value = this.ambientColor
        }
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.ambientColor.value = this.ambientColor
        }

        // Update all existing fin meshes
        for (const finMesh of this.finMeshes) {
            if (finMesh.material && finMesh.material.uniforms.ambientColor) {
                finMesh.material.uniforms.ambientColor.value = this.ambientColor
            }
        }

        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.ambientColor) {
                shellMesh.material.uniforms.ambientColor.value = this.ambientColor
            }
        }
    }

    /**
     * Render the surface layer
     * This sets up the Z-buffer for subsequent fur layers
     */
    renderSurface(camera) {
        if (!this.currentMesh) return

        // Ensure depth writing is enabled for surface layer
        this.renderer.state.setDepthTest(true)
        this.renderer.state.setDepthMask(true)

        // Render the surface mesh
        // The mesh already has the surface material applied
        // Three.js will handle the actual rendering in the main render loop
    }

    /**
     * Generate fins for the current mesh
     */
    generateFins() {
        if (!this.currentMesh || !this.finEnabled) return

        // Clear existing fins
        this.clearFins()

        // Set fin parameters in geometry generator
        this.finGeometry.setFinLength(this.finLength)
        this.finGeometry.setMaxFinCount(this.maxFinCount)

        // Set fin tapering parameters
        this.finGeometry.setTaperingEnabled(this.finTaperingEnabled)
        this.finGeometry.setTaperingIntensity(this.finTaperingIntensity)
        this.finGeometry.setTaperingCurve(this.finTaperingCurve)
        this.finGeometry.setTaperingMethod(this.finTaperingMethod)

        // Generate fin geometries
        const finGeometries = this.finGeometry.generateFins(this.currentMesh)

        // Create mesh for each fin geometry
        for (const geometry of finGeometries) {
            // Clone fin material for this mesh to allow independent wireframe control
            const finMaterial = this.finMaterial.clone()

            // Apply wireframe mode if enabled
            finMaterial.wireframe = this.finWireframeMode

            const finMesh = new THREE.Mesh(geometry, finMaterial)

            // Copy transform from base mesh
            finMesh.position.copy(this.currentMesh.position)
            finMesh.rotation.copy(this.currentMesh.rotation)
            finMesh.scale.copy(this.currentMesh.scale)

            // Add to scene and track
            this.scene.add(finMesh)
            this.finMeshes.push(finMesh)
        }

        console.log(`Generated ${this.finMeshes.length} fin meshes with tapering: ${this.finTaperingEnabled ? 'enabled' : 'disabled'}`)
    }

    /**
     * Clear all fin meshes from scene
     */
    clearFins() {
        for (const finMesh of this.finMeshes) {
            this.scene.remove(finMesh)
            if (finMesh.geometry) {
                finMesh.geometry.dispose()
            }
        }
        this.finMeshes = []
    }

    /**
     * Enable or disable fin rendering
     */
    setFinEnabled(enabled) {
        this.finEnabled = enabled
        if (enabled && this.currentMesh) {
            this.generateFins()
        } else {
            this.clearFins()
        }
    }

    /**
     * Get fin enabled status
     */
    getFinEnabled() {
        return this.finEnabled
    }

    /**
     * Set fin length
     */
    setFinLength(length) {
        this.finLength = Math.max(0, length)
        if (this.finEnabled && this.currentMesh) {
            this.generateFins() // Regenerate with new length
        }
    }

    /**
     * Get fin length
     */
    getFinLength() {
        return this.finLength
    }

    /**
     * Set maximum fin count for performance control
     * @param {number} count - Maximum number of fins (200-2000)
     */
    setMaxFinCount(count) {
        this.maxFinCount = Math.max(200, Math.min(2000, Math.floor(count)))
        if (this.finEnabled && this.currentMesh) {
            this.generateFins() // Regenerate with new count
        }
    }

    /**
     * Get maximum fin count
     */
    getMaxFinCount() {
        return this.maxFinCount
    }

    /**
     * Set fin opacity
     */
    setFinOpacity(opacity) {
        this.finOpacity = Math.max(0, Math.min(1, opacity))
        if (this.finMaterial) {
            this.finMaterial.uniforms.finOpacity.value = this.finOpacity
        }
        // Update all existing fin meshes
        for (const finMesh of this.finMeshes) {
            if (finMesh.material && finMesh.material.uniforms.finOpacity) {
                finMesh.material.uniforms.finOpacity.value = this.finOpacity
            }
        }
    }

    /**
     * Get fin opacity
     */
    getFinOpacity() {
        return this.finOpacity
    }

    /**
     * Set silhouette sensitivity
     */
    setSilhouetteSensitivity(sensitivity) {
        this.silhouetteSensitivity = Math.max(0.1, sensitivity)
        if (this.finMaterial) {
            this.finMaterial.uniforms.silhouetteSensitivity.value = this.silhouetteSensitivity
        }
        // Update all existing fin meshes
        for (const finMesh of this.finMeshes) {
            if (finMesh.material && finMesh.material.uniforms.silhouetteSensitivity) {
                finMesh.material.uniforms.silhouetteSensitivity.value = this.silhouetteSensitivity
            }
        }
    }

    /**
     * Get silhouette sensitivity
     */
    getSilhouetteSensitivity() {
        return this.silhouetteSensitivity
    }

    /**
     * Render fins with proper Z-buffer testing
     */
    renderFins(camera) {
        if (!this.finEnabled || this.finMeshes.length === 0) return

        // Set up Z-buffer testing but not writing (as per paper specification)
        this.renderer.state.setDepthTest(true)
        this.renderer.state.setDepthMask(false)

        // Fins are rendered automatically by Three.js since they're in the scene
        // The material handles the silhouette detection and alpha blending
    }

    /**
     * Generate shells for the current mesh with LOD optimization
     * @param {THREE.Camera} camera - Camera for distance calculation (optional)
     */
    generateShells(camera = null) {
        if (!this.currentMesh || !this.shellEnabled) return

        // Clear existing shells
        this.clearShells()

        // Set shell parameters in geometry generator
        this.shellGeometry.setShellCount(this.shellCount)
        this.shellGeometry.setShellSpacing(this.shellSpacing)
        this.shellGeometry.setMaxShellDistance(this.maxShellDistance)

        // Set tapering parameters
        this.shellGeometry.setTaperingEnabled(this.taperingEnabled)
        this.shellGeometry.setTaperingIntensity(this.taperingIntensity)
        this.shellGeometry.setTaperingCurve(this.taperingCurve)
        this.shellGeometry.setTaperingMethod(this.taperingMethod)

        // Calculate camera distance for LOD
        let cameraDistance = 0
        if (camera && this.currentMesh) {
            const meshPosition = new THREE.Vector3()
            this.currentMesh.getWorldPosition(meshPosition)
            cameraDistance = camera.position.distanceTo(meshPosition)
        }

        // Generate shell geometries with LOD optimization
        const shellGeometries = this.shellGeometry.generateShells(this.currentMesh, cameraDistance)
        const effectiveShellCount = shellGeometries.length

        // Create mesh for each shell geometry (render from innermost to outermost)
        for (let i = 0; i < shellGeometries.length; i++) {
            const geometry = shellGeometries[i]

            // Clone shell material for this layer
            const shellMaterial = this.shellMaterial.clone()

            // Set shell layer uniform (normalized 0.0 to 1.0)
            const normalizedLayer = (i + 1) / effectiveShellCount
            shellMaterial.uniforms.shellLayer.value = normalizedLayer
            shellMaterial.uniforms.shellCount.value = effectiveShellCount

            // Apply wireframe mode if enabled
            shellMaterial.wireframe = this.shellWireframeMode

            // Create shell mesh
            const shellMesh = new THREE.Mesh(geometry, shellMaterial)

            // Copy transform from base mesh
            shellMesh.position.copy(this.currentMesh.position)
            shellMesh.rotation.copy(this.currentMesh.rotation)
            shellMesh.scale.copy(this.currentMesh.scale)

            // Set render order for proper depth sorting (innermost first)
            shellMesh.renderOrder = 1000 + i

            // Add frustum culling optimization
            shellMesh.frustumCulled = true

            // Add to scene and track
            this.scene.add(shellMesh)
            this.shellMeshes.push(shellMesh)
        }

        console.log(`Generated ${this.shellMeshes.length} shell meshes (LOD optimized, distance: ${cameraDistance.toFixed(2)})`)
    }

    /**
     * Clear all shell meshes from scene
     */
    clearShells() {
        for (const shellMesh of this.shellMeshes) {
            this.scene.remove(shellMesh)
            if (shellMesh.geometry) {
                shellMesh.geometry.dispose()
            }
            if (shellMesh.material) {
                shellMesh.material.dispose()
            }
        }
        this.shellMeshes = []
    }

    /**
     * Enable or disable shell rendering
     */
    setShellEnabled(enabled) {
        this.shellEnabled = enabled
        if (enabled && this.currentMesh) {
            this.generateShells()
        } else {
            this.clearShells()
        }
    }

    /**
     * Get shell enabled status
     */
    getShellEnabled() {
        return this.shellEnabled
    }

    /**
     * Set shell count
     */
    setShellCount(count) {
        this.shellCount = Math.max(8, Math.min(32, Math.floor(count)))
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.shellCount.value = this.shellCount
        }
        if (this.shellEnabled && this.currentMesh) {
            this.generateShells() // Regenerate with new count
        }
    }

    /**
     * Get shell count
     */
    getShellCount() {
        return this.shellCount
    }

    /**
     * Set shell spacing
     */
    setShellSpacing(spacing) {
        this.shellSpacing = Math.max(0.001, spacing)
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.shellSpacing.value = this.shellSpacing
        }
        if (this.shellEnabled && this.currentMesh) {
            this.generateShells() // Regenerate with new spacing
        }
    }

    /**
     * Get shell spacing
     */
    getShellSpacing() {
        return this.shellSpacing
    }

    /**
     * Set shell opacity
     */
    setShellOpacity(opacity) {
        this.shellOpacity = Math.max(0, Math.min(1, opacity))
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.shellOpacity.value = this.shellOpacity
        }
        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.shellOpacity) {
                shellMesh.material.uniforms.shellOpacity.value = this.shellOpacity
            }
        }
    }

    /**
     * Get shell opacity
     */
    getShellOpacity() {
        return this.shellOpacity
    }

    /**
     * Set shell density
     */
    setShellDensity(density) {
        this.shellDensity = Math.max(0.1, density)
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.shellDensity.value = this.shellDensity
        }
        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.shellDensity) {
                shellMesh.material.uniforms.shellDensity.value = this.shellDensity
            }
        }
    }

    /**
     * Get shell density
     */
    getShellDensity() {
        return this.shellDensity
    }

    /**
     * Set shell layer opacity multiplier
     */
    setShellLayerOpacity(opacity) {
        this.shellLayerOpacity = Math.max(0, Math.min(1, opacity))
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.shellLayerOpacity.value = this.shellLayerOpacity
        }
        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.shellLayerOpacity) {
                shellMesh.material.uniforms.shellLayerOpacity.value = this.shellLayerOpacity
            }
        }
    }

    /**
     * Get shell layer opacity multiplier
     */
    getShellLayerOpacity() {
        return this.shellLayerOpacity
    }

    /**
     * Set maximum shell distance
     */
    setMaxShellDistance(distance) {
        this.maxShellDistance = Math.max(0.01, distance)
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.maxShellDistance.value = this.maxShellDistance
        }
        if (this.shellEnabled && this.currentMesh) {
            this.generateShells() // Regenerate with new distance
        }
    }

    /**
     * Get maximum shell distance
     */
    getMaxShellDistance() {
        return this.maxShellDistance
    }

    /**
     * Set shell wireframe mode for debugging
     * @param {boolean} enabled - Enable/disable wireframe mode
     */
    setShellWireframeMode(enabled) {
        this.shellWireframeMode = enabled

        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material) {
                shellMesh.material.wireframe = enabled
            }
        }

        // Update base shell material
        if (this.shellMaterial) {
            this.shellMaterial.wireframe = enabled
        }

        console.log(`Shell wireframe mode ${enabled ? 'enabled' : 'disabled'}`)
    }

    /**
     * Get shell wireframe mode status
     */
    getShellWireframeMode() {
        return this.shellWireframeMode
    }

    /**
     * Set fin wireframe mode for debugging
     * @param {boolean} enabled - Enable/disable wireframe mode
     */
    setFinWireframeMode(enabled) {
        this.finWireframeMode = enabled

        // Update all existing fin meshes
        for (const finMesh of this.finMeshes) {
            if (finMesh.material) {
                finMesh.material.wireframe = enabled
            }
        }

        // Update base fin material
        if (this.finMaterial) {
            this.finMaterial.wireframe = enabled
        }

        console.log(`Fin wireframe mode ${enabled ? 'enabled' : 'disabled'}`)
    }

    /**
     * Get fin wireframe mode status
     */
    getFinWireframeMode() {
        return this.finWireframeMode
    }

    // Tapering Control Methods

    /**
     * Enable or disable shell tapering
     * @param {boolean} enabled - Enable/disable tapering
     */
    setTaperingEnabled(enabled) {
        this.taperingEnabled = enabled
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.taperingEnabled.value = enabled ? 1.0 : 0.0
        }
        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.taperingEnabled) {
                shellMesh.material.uniforms.taperingEnabled.value = enabled ? 1.0 : 0.0
            }
        }
        if (this.shellEnabled && this.currentMesh) {
            this.generateShells() // Regenerate with new tapering setting
        }
    }

    /**
     * Get tapering enabled status
     */
    getTaperingEnabled() {
        return this.taperingEnabled
    }

    /**
     * Set tapering intensity
     * @param {number} intensity - Tapering intensity (0.0 to 1.0)
     */
    setTaperingIntensity(intensity) {
        this.taperingIntensity = Math.max(0.0, Math.min(1.0, intensity))
        if (this.shellMaterial) {
            this.shellMaterial.uniforms.taperingIntensity.value = this.taperingIntensity
        }
        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms.taperingIntensity) {
                shellMesh.material.uniforms.taperingIntensity.value = this.taperingIntensity
            }
        }
        if (this.shellEnabled && this.currentMesh) {
            this.generateShells() // Regenerate with new intensity
        }
    }

    /**
     * Get tapering intensity
     */
    getTaperingIntensity() {
        return this.taperingIntensity
    }

    /**
     * Set tapering curve type
     * @param {string} curve - Curve type: 'linear', 'quadratic', 'exponential'
     */
    setTaperingCurve(curve) {
        const validCurves = ['linear', 'quadratic', 'exponential']
        if (validCurves.includes(curve)) {
            this.taperingCurve = curve
            const curveValue = this.getTaperingCurveValue()
            if (this.shellMaterial) {
                this.shellMaterial.uniforms.taperingCurve.value = curveValue
            }
            // Update all existing shell meshes
            for (const shellMesh of this.shellMeshes) {
                if (shellMesh.material && shellMesh.material.uniforms.taperingCurve) {
                    shellMesh.material.uniforms.taperingCurve.value = curveValue
                }
            }
            if (this.shellEnabled && this.currentMesh) {
                this.generateShells() // Regenerate with new curve
            }
        }
    }

    /**
     * Get tapering curve type
     */
    getTaperingCurve() {
        return this.taperingCurve
    }

    /**
     * Set tapering method
     * @param {string} method - Scaling method: 'centroid', 'normal', 'hybrid'
     */
    setTaperingMethod(method) {
        const validMethods = ['centroid', 'normal', 'hybrid']
        if (validMethods.includes(method)) {
            this.taperingMethod = method
            if (this.shellEnabled && this.currentMesh) {
                this.generateShells() // Regenerate with new method
            }
        }
    }

    /**
     * Get tapering method
     */
    getTaperingMethod() {
        return this.taperingMethod
    }

    /**
     * Convert tapering curve string to numeric value for shader
     * @returns {number} Curve value (0=linear, 1=quadratic, 2=exponential)
     */
    getTaperingCurveValue() {
        switch (this.taperingCurve) {
            case 'linear': return 0.0
            case 'quadratic': return 1.0
            case 'exponential': return 2.0
            default: return 1.0 // Default to quadratic
        }
    }

    /**
     * Apply tapering preset configuration
     * @param {string} preset - Preset name: 'none', 'subtle', 'moderate', 'strong'
     */
    applyTaperingPreset(preset) {
        switch (preset) {
            case 'none':
                this.setTaperingEnabled(false)
                break
            case 'subtle':
                this.setTaperingEnabled(true)
                this.setTaperingIntensity(0.3)
                this.setTaperingCurve('linear')
                this.setTaperingMethod('hybrid')
                break
            case 'moderate':
                this.setTaperingEnabled(true)
                this.setTaperingIntensity(0.7)
                this.setTaperingCurve('quadratic')
                this.setTaperingMethod('hybrid')
                break
            case 'strong':
                this.setTaperingEnabled(true)
                this.setTaperingIntensity(0.9)
                this.setTaperingCurve('exponential')
                this.setTaperingMethod('centroid')
                break
            default:
                console.warn('Unknown tapering preset:', preset)
        }
    }

    // Fin Tapering Control Methods

    /**
     * Enable or disable fin tapering
     * @param {boolean} enabled - Enable/disable fin tapering
     */
    setFinTaperingEnabled(enabled) {
        this.finTaperingEnabled = enabled
        if (this.finEnabled && this.currentMesh) {
            this.generateFins() // Regenerate with new tapering setting
        }
    }

    /**
     * Get fin tapering enabled status
     */
    getFinTaperingEnabled() {
        return this.finTaperingEnabled
    }

    /**
     * Set fin tapering intensity
     * @param {number} intensity - Tapering intensity (0.0 to 1.0)
     */
    setFinTaperingIntensity(intensity) {
        this.finTaperingIntensity = Math.max(0.0, Math.min(1.0, intensity))
        if (this.finEnabled && this.currentMesh) {
            this.generateFins() // Regenerate with new intensity
        }
    }

    /**
     * Get fin tapering intensity
     */
    getFinTaperingIntensity() {
        return this.finTaperingIntensity
    }

    /**
     * Set fin tapering curve type
     * @param {string} curve - Curve type: 'linear', 'quadratic', 'exponential'
     */
    setFinTaperingCurve(curve) {
        const validCurves = ['linear', 'quadratic', 'exponential']
        if (validCurves.includes(curve)) {
            this.finTaperingCurve = curve
            if (this.finEnabled && this.currentMesh) {
                this.generateFins() // Regenerate with new curve
            }
        }
    }

    /**
     * Get fin tapering curve type
     */
    getFinTaperingCurve() {
        return this.finTaperingCurve
    }

    /**
     * Set fin tapering method
     * @param {string} method - Scaling method: 'centroid', 'normal', 'hybrid'
     */
    setFinTaperingMethod(method) {
        const validMethods = ['centroid', 'normal', 'hybrid']
        if (validMethods.includes(method)) {
            this.finTaperingMethod = method
            if (this.finEnabled && this.currentMesh) {
                this.generateFins() // Regenerate with new method
            }
        }
    }

    /**
     * Get fin tapering method
     */
    getFinTaperingMethod() {
        return this.finTaperingMethod
    }

    /**
     * Apply fin tapering preset configuration
     * @param {string} preset - Preset name: 'none', 'subtle', 'moderate', 'strong'
     */
    applyFinTaperingPreset(preset) {
        switch (preset) {
            case 'none':
                this.setFinTaperingEnabled(false)
                break
            case 'subtle':
                this.setFinTaperingEnabled(true)
                this.setFinTaperingIntensity(0.3)
                this.setFinTaperingCurve('linear')
                this.setFinTaperingMethod('hybrid')
                break
            case 'moderate':
                this.setFinTaperingEnabled(true)
                this.setFinTaperingIntensity(0.7)
                this.setFinTaperingCurve('quadratic')
                this.setFinTaperingMethod('hybrid')
                break
            case 'strong':
                this.setFinTaperingEnabled(true)
                this.setFinTaperingIntensity(0.9)
                this.setFinTaperingCurve('exponential')
                this.setFinTaperingMethod('centroid')
                break
            default:
                console.warn('Unknown fin tapering preset:', preset)
        }
    }

    /**
     * Render shells with proper depth ordering
     * Shells are rendered from innermost to outermost as per paper specification
     */
    renderShells(camera) {
        if (!this.shellEnabled || this.shellMeshes.length === 0) return

        // Set up depth testing and writing for shells
        this.renderer.state.setDepthTest(true)
        this.renderer.state.setDepthMask(true)

        // Shells are rendered automatically by Three.js since they're in the scene
        // The render order ensures proper depth sorting from innermost to outermost
        // The material handles the progressive alpha blending
    }

    // Wind Simulation Methods

    /**
     * Update wind simulation with delta time
     * Call this every frame for smooth wind animation
     */
    updateWind(deltaTime) {
        this.windSimulation.update(deltaTime)
        this.updateWindUniforms()
    }

    /**
     * Update wind uniforms in all materials
     */
    updateWindUniforms() {
        const windUniforms = this.windSimulation.getShaderUniforms()

        // Update fin material uniforms
        if (this.finMaterial) {
            Object.keys(windUniforms).forEach(key => {
                if (this.finMaterial.uniforms[key]) {
                    this.finMaterial.uniforms[key].value = windUniforms[key].value
                }
            })
        }

        // Update shell material uniforms
        if (this.shellMaterial) {
            Object.keys(windUniforms).forEach(key => {
                if (this.shellMaterial.uniforms[key]) {
                    this.shellMaterial.uniforms[key].value = windUniforms[key].value
                }
            })
        }

        // Update all existing fin meshes
        for (const finMesh of this.finMeshes) {
            if (finMesh.material && finMesh.material.uniforms) {
                Object.keys(windUniforms).forEach(key => {
                    if (finMesh.material.uniforms[key]) {
                        finMesh.material.uniforms[key].value = windUniforms[key].value
                    }
                })
            }
        }

        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms) {
                Object.keys(windUniforms).forEach(key => {
                    if (shellMesh.material.uniforms[key]) {
                        shellMesh.material.uniforms[key].value = windUniforms[key].value
                    }
                })
            }
        }
    }

    /**
     * Update tapering uniforms in all shell materials
     */
    updateTaperingUniforms() {
        const taperingUniforms = {
            taperingEnabled: { value: this.taperingEnabled ? 1.0 : 0.0 },
            taperingIntensity: { value: this.taperingIntensity },
            taperingCurve: { value: this.getTaperingCurveValue() }
        }

        // Update shell material uniforms
        if (this.shellMaterial) {
            Object.keys(taperingUniforms).forEach(key => {
                if (this.shellMaterial.uniforms[key]) {
                    this.shellMaterial.uniforms[key].value = taperingUniforms[key].value
                }
            })
        }

        // Update all existing shell meshes
        for (const shellMesh of this.shellMeshes) {
            if (shellMesh.material && shellMesh.material.uniforms) {
                Object.keys(taperingUniforms).forEach(key => {
                    if (shellMesh.material.uniforms[key]) {
                        shellMesh.material.uniforms[key].value = taperingUniforms[key].value
                    }
                })
            }
        }
    }

    /**
     * Get wind simulation instance for direct control
     */
    getWindSimulation() {
        return this.windSimulation
    }

    // Wind Direction Controls (Three-Axis)

    /**
     * Set wind direction on X-axis (left/right)
     */
    setWindDirectionX(x) {
        this.windSimulation.setWindDirectionX(x)
    }

    /**
     * Set wind direction on Y-axis (up/down)
     */
    setWindDirectionY(y) {
        this.windSimulation.setWindDirectionY(y)
    }

    /**
     * Set wind direction on Z-axis (forward/backward)
     */
    setWindDirectionZ(z) {
        this.windSimulation.setWindDirectionZ(z)
    }

    /**
     * Set complete wind direction vector
     */
    setWindDirection(x, y, z) {
        this.windSimulation.setWindDirection(x, y, z)
    }

    /**
     * Get current wind direction
     */
    getWindDirection() {
        return this.windSimulation.getWindDirection()
    }

    // Wind Strength Control

    /**
     * Set global wind strength
     */
    setWindStrength(strength) {
        this.windSimulation.setWindStrength(strength)
    }

    /**
     * Get current wind strength
     */
    getWindStrength() {
        return this.windSimulation.getWindStrength()
    }

    // Turbulence Controls

    /**
     * Set turbulence intensity
     */
    setTurbulenceIntensity(intensity) {
        this.windSimulation.setTurbulenceIntensity(intensity)
    }

    /**
     * Get turbulence intensity
     */
    getTurbulenceIntensity() {
        return this.windSimulation.getTurbulenceIntensity()
    }

    /**
     * Set turbulence frequency
     */
    setTurbulenceFrequency(frequency) {
        this.windSimulation.setTurbulenceFrequency(frequency)
    }

    /**
     * Get turbulence frequency
     */
    getTurbulenceFrequency() {
        return this.windSimulation.getTurbulenceFrequency()
    }

    // Gust Controls

    /**
     * Set gust strength
     */
    setGustStrength(strength) {
        this.windSimulation.setGustStrength(strength)
    }

    /**
     * Get gust strength
     */
    getGustStrength() {
        return this.windSimulation.getGustStrength()
    }

    /**
     * Set gust frequency
     */
    setGustFrequency(frequency) {
        this.windSimulation.setGustFrequency(frequency)
    }

    /**
     * Get gust frequency
     */
    getGustFrequency() {
        return this.windSimulation.getGustFrequency()
    }

    /**
     * Set gust duration
     */
    setGustDuration(duration) {
        this.windSimulation.setGustDuration(duration)
    }

    /**
     * Get gust duration
     */
    getGustDuration() {
        return this.windSimulation.getGustDuration()
    }

    // Wind Dampening and Responsiveness

    /**
     * Set wind dampening factor
     */
    setWindDampening(dampening) {
        this.windSimulation.setWindDampening(dampening)
    }

    /**
     * Get wind dampening factor
     */
    getWindDampening() {
        return this.windSimulation.getWindDampening()
    }

    /**
     * Set wind responsiveness
     */
    setWindResponsiveness(responsiveness) {
        this.windSimulation.setWindResponsiveness(responsiveness)
    }

    /**
     * Get wind responsiveness
     */
    getWindResponsiveness() {
        return this.windSimulation.getWindResponsiveness()
    }

    // Animation Controls

    /**
     * Set wind animation speed
     */
    setWindAnimationSpeed(speed) {
        this.windSimulation.setAnimationSpeed(speed)
    }

    /**
     * Get wind animation speed
     */
    getWindAnimationSpeed() {
        return this.windSimulation.getAnimationSpeed()
    }

    /**
     * Enable or disable wind simulation
     */
    setWindEnabled(enabled) {
        this.windSimulation.setWindEnabled(enabled)
    }

    /**
     * Get wind enabled status
     */
    getWindEnabled() {
        return this.windSimulation.getWindEnabled()
    }

    // Wind Randomness Controls

    /**
     * Set wind randomness intensity for per-strand variation
     */
    setWindRandomnessIntensity(intensity) {
        this.windSimulation.setWindRandomnessIntensity(intensity)
    }

    /**
     * Get wind randomness intensity
     */
    getWindRandomnessIntensity() {
        return this.windSimulation.getWindRandomnessIntensity()
    }

    // Wind Preset Methods

    /**
     * Apply gentle breeze wind preset
     */
    applyGentleBreezePreset() {
        this.windSimulation.applyGentleBreezePreset()
    }

    /**
     * Apply strong wind preset
     */
    applyStrongWindPreset() {
        this.windSimulation.applyStrongWindPreset()
    }

    /**
     * Apply storm wind preset
     */
    applyStormPreset() {
        this.windSimulation.applyStormPreset()
    }

    /**
     * Reset wind to calm conditions
     */
    resetWindToCalm() {
        this.windSimulation.resetToCalm()
    }


    /**
     * Get performance statistics
     * @returns {Object} Performance and memory usage statistics
     */
    getPerformanceStats() {
        const shellStats = this.shellGeometry.getPerformanceStats()
        const finStats = {
            finMeshCount: this.finMeshes.length,
            shellMeshCount: this.shellMeshes.length
        }

        return {
            ...shellStats,
            ...finStats,
            webgl2Supported: this.isWebGL2,
            windEnabled: this.windSimulation.getWindEnabled()
        }
    }

    /**
     * Get WebGL2 support status
     */
    isWebGL2Supported() {
        return this.isWebGL2
    }

    /**
     * Dispose of resources
     */
    dispose() {
        if (this.currentMesh && this.originalMaterial) {
            this.currentMesh.material = this.originalMaterial
        }

        this.clearFins()
        this.clearShells()

        if (this.surfaceMaterial) {
            this.surfaceMaterial.dispose()
        }

        if (this.finMaterial) {
            this.finMaterial.dispose()
        }

        if (this.shellMaterial) {
            this.shellMaterial.dispose()
        }

        if (this.finGeometry) {
            this.finGeometry.dispose()
        }

        if (this.shellGeometry) {
            this.shellGeometry.dispose()
        }

        if (this.windSimulation) {
            this.windSimulation.dispose()
        }

        this.currentMesh = null
        this.originalMaterial = null
    }
}