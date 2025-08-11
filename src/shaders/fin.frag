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