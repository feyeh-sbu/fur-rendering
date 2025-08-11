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