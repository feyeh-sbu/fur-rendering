precision highp float;

// Shell fragment shader for fur rendering
// Optimized for performance with enhanced visual quality
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
    // Normalize the interpolated normal (optimized)
    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);

    // Enhanced lighting calculation with rim lighting for better fur appearance
    vec3 lightDir = normalize(lightDirection);
    float diffuse = max(0.0, dot(normal, lightDir));

    // Add rim lighting for better fur volume perception
    vec3 viewDir = normalize(-vViewPosition);
    float rimFactor = 1.0 - max(0.0, dot(normal, viewDir));
    float rimLight = pow(rimFactor, 2.0) * 0.3;

    // Enhanced lighting combination
    vec3 lighting = ambientColor + (diffuse * lightIntensity) + vec3(rimLight);

    // Apply lighting to fur color
    vec3 baseColor = furColor * lighting;

    // Enhanced progressive alpha calculation for better fur volume
    float normalizedLayer = vShellLayer;

    // Optimized falloff calculation using single function
    // Combines multiple falloff types for realistic fur appearance
    float falloffBase = 1.0 - normalizedLayer;
    float expComponent = exp(-normalizedLayer * 1.8);
    float smoothComponent = falloffBase * falloffBase * (3.0 - 2.0 * falloffBase); // Smoothstep

    // Blend falloff components for optimal visual result
    float combinedFalloff = mix(smoothComponent, expComponent, 0.4);

    // Apply shell density control with enhanced curve
    float densityFactor = shellDensity;
    combinedFalloff *= densityFactor;

    // Apply global shell opacity multiplier
    float finalAlpha = combinedFalloff * shellOpacity * shellLayerOpacity;

    // Apply the pre-calculated alpha from vertex shader
    finalAlpha *= vShellAlpha;

    // Enhanced alpha threshold for better performance
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);
    if (finalAlpha < 0.02) {
        discard;
    }

    // Enhanced color variation for better visual depth
    // Outer shells get subtle color variation and light absorption
    float layerVariation = normalizedLayer * 0.15;
    float layerDarkening = 1.0 - layerVariation;

    // Add subtle color shift for depth perception
    vec3 depthColor = mix(baseColor, baseColor * 0.9, normalizedLayer * 0.3);
    vec3 finalColor = depthColor * layerDarkening;

    // Add subtle procedural noise for fur texture variation
    float noisePattern = sin(vWorldPosition.x * 50.0) * cos(vWorldPosition.z * 50.0) * 0.05;
    finalColor += vec3(noisePattern);

    // Output final color with progressive alpha
    gl_FragColor = vec4(finalColor, finalAlpha);
}