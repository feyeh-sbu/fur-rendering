// Shell vertex shader for fur rendering with wind displacement
// Optimized for performance with enhanced visual quality
// Implements the shell method as described in section 2.3 of the fur rendering paper
// Enhanced with three-axis wind simulation and progressive layer displacement

// Shell-specific uniforms
uniform float shellLayer;        // Current shell layer (0.0 to 1.0)
uniform float shellCount;        // Total number of shell layers
uniform float shellSpacing;      // Distance between shell layers
uniform float maxShellDistance;  // Maximum shell offset distance

// Tapering uniforms
uniform float taperingEnabled;   // Tapering enable/disable (0.0 or 1.0)
uniform float taperingIntensity; // Tapering intensity (0.0 to 1.0)
uniform float taperingCurve;     // Tapering curve type (0=linear, 1=quadratic, 2=exponential)

// Wind simulation uniforms
uniform vec3 windVector;         // Current wind force vector
uniform float windStrength;      // Global wind strength multiplier
uniform float windTime;          // Animation time for wind effects
uniform float windEnabled;       // Wind enable/disable (0.0 or 1.0)
uniform float turbulenceIntensity; // Turbulence intensity
uniform float gustStrength;      // Gust strength
uniform float windRandomnessIntensity; // Per-strand wind randomness intensity

// Output to fragment shader
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying float vShellLayer;
varying float vShellAlpha;
varying vec3 vWindDisplacement; // Wind displacement for fragment shader
varying float vTaperingScale;   // Tapering scale factor for fragment shader

// Input randomized normal attribute from geometry
attribute vec3 randomizedNormal;

// Calculate tapering scale factor based on shell layer and curve type
float calculateTaperingScale(float layer, float intensity, float curveType) {
    if (intensity <= 0.0) {
        return 1.0;
    }

    float curveFactor;
    if (curveType < 0.5) {
        // Linear tapering
        curveFactor = layer;
    } else if (curveType < 1.5) {
        // Quadratic tapering
        curveFactor = layer * layer;
    } else {
        // Exponential tapering
        curveFactor = pow(layer, 2.5);
    }

    // Apply tapering intensity
    float taperingAmount = curveFactor * intensity;
    return 1.0 - taperingAmount;
}

// Optimized wind displacement calculation function using pre-computed randomized normals
vec3 calculateWindDisplacement(vec3 worldPos, vec3 worldNormal, vec3 randomizedWorldNormal, float layer) {
    // Early exit for disabled wind
    if (windEnabled < 0.5) {
        return vec3(0.0);
    }

    // Progressive scaling: outer shells more affected by wind
    float layerFactor = layer; // Already normalized 0.0 to 1.0
    float progressiveScale = layerFactor * layerFactor * (3.0 - 2.0 * layerFactor); // Smoothstep for better distribution

    // Use randomized normal direction for wind displacement instead of per-vertex randomness
    vec3 windDirection = windVector;

    // Apply face-based randomness to wind direction using pre-computed randomized normals
    if (windRandomnessIntensity > 0.0) {
        // Blend between original wind direction and randomized normal direction
        float layerRandomness = windRandomnessIntensity * (0.5 + 0.5 * layer);

        // Use randomized normal to create consistent directional variation per face
        vec3 randomizedWindDirection = normalize(windVector + (randomizedWorldNormal - worldNormal) * layerRandomness);
        windDirection = mix(windVector, randomizedWindDirection, layerRandomness);
    }

    // Base wind displacement with face-consistent randomized direction
    vec3 windDisplacement = windDirection * progressiveScale;

    // Optimized position-based variation using fewer trigonometric functions
    float time1 = windTime + worldPos.x * 2.0;
    float time2 = windTime * 0.8 + worldPos.z * 1.5;
    float positionVariation = sin(time1) * cos(time2) * 0.3;
    windDisplacement *= (1.0 + positionVariation);

    // Enhanced normal-based displacement using randomized normal for better surface interaction
    float normalInfluence = dot(windDirection, randomizedWorldNormal);
    vec3 normalDisplacement = randomizedWorldNormal * normalInfluence * progressiveScale * 0.25;
    windDisplacement += normalDisplacement;

    // Optimized scaling with distance-based attenuation
    float distanceScale = shellSpacing * 8.0; // Reduced multiplier for better control
    windDisplacement *= distanceScale;

    return windDisplacement;
}

void main() {
    // Pass shell layer information to fragment shader
    vShellLayer = shellLayer;

    // Calculate tapering scale factor for this shell layer
    float taperingScale = 1.0;
    if (taperingEnabled > 0.5) {
        taperingScale = calculateTaperingScale(shellLayer, taperingIntensity, taperingCurve);
    }
    vTaperingScale = taperingScale;

    // Enhanced progressive alpha calculation for better fur volume
    float normalizedLayer = shellLayer;
    vShellAlpha = 1.0 - (normalizedLayer * normalizedLayer * 0.9); // Quadratic falloff for better volume

    // Apply tapering to alpha for additional visual effect
    if (taperingEnabled > 0.5) {
        vShellAlpha *= mix(1.0, taperingScale, 0.3); // Subtle alpha tapering
    }

    // Transform both original and randomized normals
    vWorldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    vNormal = normalMatrix * normal;

    // Transform randomized normal to world space
    vec3 randomizedWorldNormal = (modelMatrix * vec4(randomizedNormal, 0.0)).xyz;

    // Use original vertex position (geometry-based tapering is applied in ShellGeometry.js)
    vec3 vertexPosition = position;

    // Calculate world position before wind displacement
    vec3 worldPosition = (modelMatrix * vec4(vertexPosition, 1.0)).xyz;

    // Calculate wind displacement using both original and randomized normals
    vec3 windDisplacement = calculateWindDisplacement(worldPosition, vWorldNormal, randomizedWorldNormal, shellLayer);
    vWindDisplacement = windDisplacement; // Pass to fragment shader for effects

    // Apply wind displacement to world position
    worldPosition += windDisplacement;

    // Optimized position transformation - avoid inverse matrix calculation
    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Pass UV coordinates for texture mapping
    vUv = uv;

    // Pass view space position for depth-based effects
    vPosition = mvPosition.xyz;
    vViewPosition = mvPosition.xyz;

    // Store final world position (with wind displacement)
    vWorldPosition = worldPosition;
}