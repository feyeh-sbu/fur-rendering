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