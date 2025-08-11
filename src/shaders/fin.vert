// Fin vertex shader for fur rendering with wind effects
// Handles fin geometry transformations, silhouette detection, and wind displacement
// Enhanced with three-axis wind simulation for consistent fur movement

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
varying vec3 vCameraDirection;
varying vec3 vWindDisplacement; // Wind displacement for fragment shader

// Generate consistent per-vertex random values based on position
// This ensures the randomness is consistent per face/vertex and doesn't change every frame
vec3 generateVertexRandom(vec3 worldPos) {
    // Use world position as seed for consistent randomness
    vec3 seed = worldPos * 12.9898;

    // Generate pseudo-random values using sine functions
    float randX = fract(sin(dot(seed.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float randY = fract(sin(dot(seed.yz, vec2(12.9898, 78.233))) * 43758.5453);
    float randZ = fract(sin(dot(seed.xz, vec2(12.9898, 78.233))) * 43758.5453);

    // Convert from [0,1] to [-1,1] range for directional offsets
    return vec3(randX * 2.0 - 1.0, randY * 2.0 - 1.0, randZ * 2.0 - 1.0);
}

// Wind displacement calculation function for fins
vec3 calculateFinWindDisplacement(vec3 worldPos, vec3 worldNormal) {
    if (windEnabled < 0.5) {
        return vec3(0.0);
    }

    // Fins use full wind effect for consistent movement with shells
    vec3 windDisplacement = windVector;

    // Add per-vertex random directional offset for natural variation
    if (windRandomnessIntensity > 0.0) {
        vec3 randomOffset = generateVertexRandom(worldPos);

        // Scale the random offset by intensity and apply it as a directional modifier
        vec3 randomDirection = normalize(windVector + randomOffset * windRandomnessIntensity);

        // Blend between original wind direction and randomized direction
        windDisplacement = mix(windVector, randomDirection * length(windVector), windRandomnessIntensity);
    }

    // Add position-based variation for natural fin movement
    float positionVariation = sin(worldPos.x * 3.0 + windTime * 1.2) *
                             cos(worldPos.z * 2.5 + windTime) * 0.4;
    windDisplacement *= (1.0 + positionVariation);

    // Add normal-based displacement for surface-following wind
    float normalInfluence = dot(normalize(windVector), worldNormal);
    vec3 normalDisplacement = worldNormal * normalInfluence * 0.3;
    windDisplacement += normalDisplacement;

    // Add height-based variation (fins higher up move more)
    float heightFactor = (worldPos.y + 2.0) * 0.1; // Adjust based on model scale
    windDisplacement *= (1.0 + heightFactor);

    // Scale displacement for fin geometry
    windDisplacement *= 0.05; // Fins are more responsive but smaller displacement

    return windDisplacement;
}

void main() {
    // Transform normal to world space first (needed for wind calculations)
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    // Calculate world position before wind displacement
    vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    // Calculate wind displacement for fins
    vec3 windDisplacement = calculateFinWindDisplacement(worldPosition, vWorldNormal);
    vWindDisplacement = windDisplacement; // Pass to fragment shader for effects

    // Apply wind displacement to world position
    worldPosition += windDisplacement;

    // Transform displaced position to view space
    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Transform normal to view space for lighting calculations
    vNormal = normalize(normalMatrix * normal);

    // Pass UV coordinates for texture mapping
    vUv = uv;

    // Pass view space position
    vPosition = mvPosition.xyz;
    vViewPosition = mvPosition.xyz;

    // Calculate camera direction in world space for silhouette detection
    // Use final displaced world position for accurate silhouette calculation
    vec3 cameraPosition = (inverse(viewMatrix) * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vCameraDirection = normalize(cameraPosition - worldPosition);
}