import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { ModelLoader } from './core/ModelLoader.js';
import { ParameterPanel } from './ui/ParameterPanel.js';
import { FurRenderer } from './core/FurRenderer.js';

export class FurApp {
  constructor(container = document.body) {
    this.container = container;

    // Core Three.js
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Systems
    this.modelLoader = null;
    this.parameterPanel = null;
    this.furRenderer = null;

    // Stats.js for performance monitoring
    this.stats = null;

    // State
    this.currentMesh = null;
    this.isAnimating = true;
    this.animationId = null;

    // Camera controls
    this.cameraRadius = 2.5; // Default camera distance
    this.minCameraRadius = 0.5; // Minimum zoom distance
    this.maxCameraRadius = 10.0; // Maximum zoom distance
    this.zoomSpeed = 0.1; // Zoom sensitivity

    // Animation timing for wind simulation
    this.lastTime = 0;
    this.deltaTime = 0;


    // Error handling
    this.errorHandler = this.setupErrorHandling();

    // Bindings
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.animate = this.animate.bind(this);

    this.init().catch(error => {
      console.error('Failed to initialize FurApp:', error);
      this.handleError(error, 'Application Startup');
    });
  }

  async init() {
    try {
      this.setupRenderer();
      this.setupScene();
      this.setupCamera();
      this.setupLights();
      this.setupModelLoader();
      await this.setupFurRenderer();
      this.setupStats();
      this.setupUI();
      this.setupEvents();
      await this.loadDefaultModel();
      this.start();
    } catch (error) {
      this.handleError(error, 'Initialization');
    }
  }

  setupRenderer() {
    // Create WebGL2 context
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });

    if (!context) {
      console.warn('WebGL2 not supported, falling back to WebGL1');
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } else {
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        context: context,
        antialias: true,
        alpha: false
      });
      console.log('WebGL2 context created successfully');
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Enable depth testing for proper fur rendering
    this.renderer.sortObjects = true;
    this.renderer.autoClear = true;

    this.container.appendChild(this.renderer.domElement);
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(2.5, 1.0, 2.5);
    this.camera.lookAt(0, 0, 0);
  }

  setupLights() {
    // Minimal lighting sufficient to view models
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 2);
    this.scene.add(dir);
  }

  setupModelLoader() {
    this.modelLoader = new ModelLoader();
  }

  async setupFurRenderer() {
    this.furRenderer = new FurRenderer(this.renderer, this.scene);
    await this.furRenderer.init();
    console.log('Fur renderer initialized, WebGL2 support:', this.furRenderer.isWebGL2Supported());
  }

  setupStats() {
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  }

  setupUI() {
    // Setup parameter panel with model loader and fur renderer
    this.parameterPanel = new ParameterPanel(this.modelLoader, this.furRenderer);

    // When selection changes, load the chosen model by name or index
    this.parameterPanel.setModelChangeCallback(async (nameOrIndex) => {
      const mesh = await this.modelLoader.loadModel(nameOrIndex);
      this.setCurrentModel(mesh);
    });
  }

  setupEvents() {
    window.addEventListener('resize', this.onWindowResize, false);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.isAnimating ? this.pause() : this.resume();
      }
    });

    // Add mouse wheel zoom functionality
    this.renderer.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });
  }

  async loadDefaultModel() {
    try {
      const models = this.modelLoader.getAvailableModels();
      if (models.length > 0) {
        // Prefer first listed model
        const mesh = await this.modelLoader.loadModel(0);
        this.setCurrentModel(mesh);
      } else {
        // Fallback: simple sphere
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8, metalness: 0.1 });
        const mesh = new THREE.Mesh(geometry, material);
        this.setCurrentModel(mesh);
      }
    } catch (err) {
      console.error('Failed to load default model:', err);
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8, metalness: 0.1 });
      const mesh = new THREE.Mesh(geometry, material);
      this.setCurrentModel(mesh);
    }
  }

  async loadModel(nameOrIndex) {
    const mesh = await this.modelLoader.loadModel(nameOrIndex);
    this.setCurrentModel(mesh);
  }

  setCurrentModel(mesh) {
    // Remove previous
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      if (this.currentMesh.geometry) this.currentMesh.geometry.dispose();
      if (this.currentMesh.material) this.currentMesh.material.dispose();
    }
    this.currentMesh = mesh;
    this.currentMesh.castShadow = false;
    this.currentMesh.receiveShadow = false;
    this.scene.add(this.currentMesh);

    // Apply fur rendering to the new mesh
    if (this.furRenderer) {
      this.furRenderer.setMesh(this.currentMesh);
    }
  }

  start() {
    if (!this.isAnimating) {
      this.isAnimating = true;
    }
    this.animate();
  }

  pause() {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resume() {
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animate();
    }
  }

  animate() {
    if (!this.isAnimating) return;

    this.animationId = requestAnimationFrame(this.animate);

    // Begin stats monitoring
    if (this.stats) this.stats.begin();

    try {
      // Calculate delta time for smooth wind animation
      const currentTime = performance.now() * 0.001;
      this.deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      // Update wind simulation with delta time
      if (this.furRenderer) {
        this.furRenderer.updateWind(this.deltaTime);
      }


      // Auto-orbit the camera around origin with dynamic radius
      const t = currentTime;
      const radius = this.cameraRadius; // Use dynamic camera radius
      const height = 0.9 + Math.sin(t * 0.25) * 0.2;
      this.camera.position.set(
        Math.cos(t * 0.1) * radius,
        height,
        Math.sin(t * 0.1) * radius
      );
      this.camera.lookAt(0, 0, 0);

      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('Animation loop error:', error);
      this.handleError(error, 'Animation Loop');
    }

    // End stats monitoring
    if (this.stats) this.stats.end();
  }


  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'Global Error');
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'Unhandled Promise Rejection');
    });

    // WebGL context lost handler
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.handleWebGLContextLoss();
      });

      this.renderer.domElement.addEventListener('webglcontextrestored', () => {
        this.handleWebGLContextRestore();
      });
    }
  }

  /**
   * Handle errors with user-friendly messages
   * @param {Error} error - The error object
   * @param {string} context - Context where the error occurred
   */
  handleError(error, context = 'Unknown') {
    console.error(`[${context}] Error:`, error);

    // Show user-friendly error message
    this.showErrorMessage(`${context}: ${error.message || 'An unexpected error occurred'}`);
  }

  /**
   * Show error message to user
   * @param {string} message - Error message to display
   */
  showErrorMessage(message) {
    // Create error overlay
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      z-index: 10001;
      max-width: 400px;
      text-align: center;
    `;
    errorDiv.innerHTML = `
      <h3>Error</h3>
      <p>${message}</p>
      <button onclick="this.parentNode.remove()" style="
        background: white;
        color: red;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
      ">Close</button>
    `;
    document.body.appendChild(errorDiv);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 10000);
  }

  /**
   * Handle WebGL context loss
   */
  handleWebGLContextLoss() {
    console.warn('WebGL context lost');
    this.pause();
    this.showErrorMessage('WebGL context lost. The application has been paused.');
  }

  /**
   * Handle WebGL context restore
   */
  handleWebGLContextRestore() {
    console.log('WebGL context restored');
    this.showErrorMessage('WebGL context restored. Reloading the page is recommended.');

    // Optionally reload the page
    setTimeout(() => {
      if (confirm('WebGL context has been restored. Would you like to reload the page?')) {
        window.location.reload();
      }
    }, 2000);
  }

  onMouseWheel(e) {
    e.preventDefault();

    // Determine zoom direction (scroll up = zoom in, scroll down = zoom out)
    const zoomDirection = e.deltaY > 0 ? 1 : -1;

    // Update camera radius with zoom speed
    this.cameraRadius += zoomDirection * this.zoomSpeed;

    // Clamp radius to min/max bounds
    this.cameraRadius = Math.max(this.minCameraRadius, Math.min(this.maxCameraRadius, this.cameraRadius));

    console.log(`Camera zoom: ${this.cameraRadius.toFixed(2)}`);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    this.pause();

    if (this.stats && this.stats.dom && this.stats.dom.parentNode) {
      this.stats.dom.parentNode.removeChild(this.stats.dom);
    }

    if (this.furRenderer) {
      this.furRenderer.dispose();
    }

    if (this.parameterPanel) {
      this.parameterPanel.dispose?.();
    }

    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      if (this.currentMesh.geometry) this.currentMesh.geometry.dispose();
      if (this.currentMesh.material) this.currentMesh.material.dispose();
      this.currentMesh = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    window.removeEventListener('resize', this.onWindowResize);

    // Remove wheel event listener
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('wheel', this.onMouseWheel);
    }
  }
}