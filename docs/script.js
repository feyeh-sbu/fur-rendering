// Initialize Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a triangle
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([
  -1.0, -1.0, 0.0,  // vertex 1 (x, y, z)
  1.0, -1.0, 0.0,   // vertex 2
  0.0, 1.0, 0.0     // vertex 3
]);
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const triangle = new THREE.Mesh(geometry, material);
scene.add(triangle);

// Position camera
camera.position.z = 3;

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  triangle.rotation.z += 0.01;
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});