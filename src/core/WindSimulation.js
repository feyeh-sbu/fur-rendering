import * as THREE from 'three';

/**
 * WindSimulation - Advanced wind simulation system for fur rendering
 * Implements three-axis directional controls, turbulence, gusts, and physics-based displacement
 * Provides real-time wind effects with smooth animation and performance optimization
 */
export class WindSimulation {
    constructor() {
        // Wind direction controls (three-axis)
        this.windDirection = new THREE.Vector3(0.3, 0.4, 0.7);
        this.windStrength = 1.0; // Global wind intensity multiplier (0.0 to 2.0)

        // Advanced wind physics parameters
        this.turbulenceIntensity = 0.4; // Random wind variations (0.0 to 1.0)
        this.turbulenceFrequency = 2.0; // Turbulence speed multiplier (0.1 to 5.0)
        this.gustStrength = 0.5; // Periodic wind bursts strength (0.0 to 2.0)
        this.gustFrequency = 0.7; // Gust frequency (0.1 to 3.0)
        this.gustDuration = 2.0; // Gust duration in seconds (0.5 to 5.0)
        this.windDampening = 0.7; // Wind effect falloff (0.1 to 1.0)
        this.windResponsiveness = 1.0; // How quickly wind changes take effect (0.1 to 3.0)

        // Per-strand wind randomness for natural variation
        this.windRandomnessIntensity = 0.3; // Random directional offset intensity (0.0 to 1.0)

        // Animation and timing
        this.animationSpeed = 1.0; // Wind animation speed multiplier (0.1 to 3.0)
        this.windEnabled = true; // Master wind enable/disable
        this.time = 0.0; // Internal animation time

        // Physics calculation cache
        this.cachedWindForce = new THREE.Vector3();
        this.cachedTurbulence = new THREE.Vector3();
        this.cachedGustForce = new THREE.Vector3();
        this.finalWindVector = new THREE.Vector3();

        // Performance optimization
        this.updateFrequency = 60; // Updates per second
        this.lastUpdateTime = 0;
        this.deltaTime = 0;
        this.frameSkipCounter = 0;
        this.frameSkipThreshold = 2; // Skip every N frames for performance

        // Enhanced noise functions for turbulence
        this.noiseOffset = {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            z: Math.random() * 1000
        };

        // Performance monitoring
        this.performanceStats = {
            updateCount: 0,
            averageUpdateTime: 0,
            lastUpdateDuration: 0
        };

        // Wind quality hardcoded to high for best performance
        this.qualityLevel = 'high';
        this.frameSkipThreshold = 1; // High quality settings

        console.log('WindSimulation initialized with performance optimizations');
    }

    /**
     * Update wind simulation with time-based animation
     * Call this every frame for smooth wind effects
     */
    update(deltaTime) {
        if (!this.windEnabled) {
            this.finalWindVector.set(0, 0, 0);
            return;
        }


        // Performance monitoring
        const startTime = performance.now();

        this.deltaTime = deltaTime;
        this.time += deltaTime * this.animationSpeed;

        // Calculate wind forces based on quality level
        this.calculateWindForces();

        // Update performance statistics
        const endTime = performance.now();
        this.updatePerformanceStats(endTime - startTime);

    }

    /**
     * Calculate all wind forces based on current quality level
     */
    calculateWindForces() {
        // Calculate base wind force from direction and strength
        this.calculateBaseWindForce();

        // Add turbulence for natural wind variation (always enabled for high quality)
        this.calculateTurbulence();

        // Add periodic gusts for dynamic effects (always enabled for high quality)
        this.calculateGusts();

        // Combine all wind forces with dampening
        this.combineFinalWindVector();
    }

    /**
     * Update performance statistics
     * @param {number} updateDuration - Time taken for this update in milliseconds
     */
    updatePerformanceStats(updateDuration) {
        this.performanceStats.updateCount++;
        this.performanceStats.lastUpdateDuration = updateDuration;

        // Calculate rolling average
        const alpha = 0.1; // Smoothing factor
        this.performanceStats.averageUpdateTime =
            this.performanceStats.averageUpdateTime * (1 - alpha) + updateDuration * alpha;
    }


    /**
     * Calculate base wind force from user-controlled direction and strength
     */
    calculateBaseWindForce() {
        this.cachedWindForce.copy(this.windDirection);
        this.cachedWindForce.multiplyScalar(this.windStrength);
    }

    /**
     * Calculate turbulence using optimized noise functions
     * Creates natural wind variation and movement
     */
    calculateTurbulence() {
        if (this.turbulenceIntensity <= 0) {
            this.cachedTurbulence.set(0, 0, 0);
            return;
        }

        const turbTime = this.time * this.turbulenceFrequency;

        // Always use high quality: complex multi-octave noise
        this.calculateHighQualityTurbulence(turbTime);
    }

    /**
     * Calculate high-quality turbulence with multiple octaves
     * @param {number} turbTime - Turbulence time parameter
     */
    calculateHighQualityTurbulence(turbTime) {
        // Multi-octave noise for more realistic turbulence
        const octave1 = this.calculateTurbulenceOctave(turbTime, 1.0, 1.0);
        const octave2 = this.calculateTurbulenceOctave(turbTime, 2.0, 0.5);
        const octave3 = this.calculateTurbulenceOctave(turbTime, 4.0, 0.25);

        this.cachedTurbulence.copy(octave1);
        this.cachedTurbulence.add(octave2);
        this.cachedTurbulence.add(octave3);
        this.cachedTurbulence.multiplyScalar(this.turbulenceIntensity);
    }

    /**
     * Calculate simple turbulence for performance
     * @param {number} turbTime - Turbulence time parameter
     */
    calculateSimpleTurbulence(turbTime) {
        // Single octave for better performance
        const turbulence = this.calculateTurbulenceOctave(turbTime, 1.0, 1.0);
        this.cachedTurbulence.copy(turbulence);
        this.cachedTurbulence.multiplyScalar(this.turbulenceIntensity);
    }

    /**
     * Calculate a single turbulence octave
     * @param {number} time - Time parameter
     * @param {number} frequency - Frequency multiplier
     * @param {number} amplitude - Amplitude multiplier
     * @returns {THREE.Vector3} Turbulence vector for this octave
     */
    calculateTurbulenceOctave(time, frequency, amplitude) {
        const t = time * frequency;

        const turbX = Math.sin(t + this.noiseOffset.x) *
                     Math.cos(t * 1.3 + this.noiseOffset.x * 0.7) *
                     amplitude;

        const turbY = Math.sin(t * 1.1 + this.noiseOffset.y) *
                     Math.cos(t * 0.9 + this.noiseOffset.y * 0.8) *
                     amplitude;

        const turbZ = Math.sin(t * 0.8 + this.noiseOffset.z) *
                     Math.cos(t * 1.2 + this.noiseOffset.z * 0.6) *
                     amplitude;

        return new THREE.Vector3(turbX, turbY, turbZ);
    }

    /**
     * Calculate periodic wind gusts for dramatic effects
     * Creates bursts of stronger wind at regular intervals
     */
    calculateGusts() {
        if (this.gustStrength <= 0) {
            this.cachedGustForce.set(0, 0, 0);
            return;
        }

        const gustTime = this.time * this.gustFrequency;
        const gustCycle = Math.sin(gustTime) * 0.5 + 0.5; // Normalize to 0-1

        // Create gust envelope with sharp attack and gradual decay
        const gustEnvelope = Math.pow(gustCycle, 2.0) *
                           Math.exp(-Math.abs(Math.sin(gustTime * this.gustDuration)) * 2.0);

        // Apply gust in the primary wind direction with some variation
        const gustDirection = this.windDirection.clone();
        gustDirection.normalize();

        // Add slight directional variation to gusts
        const gustVariation = new THREE.Vector3(
            Math.sin(gustTime * 2.1) * 0.3,
            Math.sin(gustTime * 1.7) * 0.2,
            Math.sin(gustTime * 2.3) * 0.3
        );

        gustDirection.add(gustVariation);
        gustDirection.normalize();
        gustDirection.multiplyScalar(gustEnvelope * this.gustStrength);

        this.cachedGustForce.copy(gustDirection);
    }

    /**
     * Combine all wind forces and apply dampening
     */
    combineFinalWindVector() {
        // Start with base wind force
        this.finalWindVector.copy(this.cachedWindForce);

        // Add turbulence
        this.finalWindVector.add(this.cachedTurbulence);

        // Add gusts
        this.finalWindVector.add(this.cachedGustForce);

        // Apply wind dampening for natural falloff
        this.finalWindVector.multiplyScalar(this.windDampening);

        // Apply responsiveness (how quickly changes take effect)
        if (this.windResponsiveness !== 1.0) {
            const responseFactor = Math.min(this.deltaTime * this.windResponsiveness * 10.0, 1.0);
            this.finalWindVector.multiplyScalar(responseFactor);
        }
    }

    /**
     * Get current wind vector for shader uniforms
     * Returns the final calculated wind force
     */
    getWindVector() {
        return this.finalWindVector.clone();
    }

    /**
     * Get wind displacement for a specific shell layer
     * Outer layers are more affected by wind than inner layers
     */
    getWindDisplacementForLayer(layerIndex, totalLayers) {
        if (!this.windEnabled || totalLayers <= 0) {
            return new THREE.Vector3(0, 0, 0);
        }

        // Progressive scaling: outer shells more affected by wind
        const layerFactor = (layerIndex + 1) / totalLayers;
        const progressiveScale = Math.pow(layerFactor, 1.5); // Non-linear scaling for more natural effect

        const displacement = this.finalWindVector.clone();
        displacement.multiplyScalar(progressiveScale);

        return displacement;
    }

    /**
     * Get wind displacement for fin geometry
     * Fins use full wind effect for consistent movement
     */
    getWindDisplacementForFins() {
        if (!this.windEnabled) {
            return new THREE.Vector3(0, 0, 0);
        }

        return this.finalWindVector.clone();
    }

    // Wind Direction Controls (Three-Axis)

    /**
     * Set wind direction on X-axis (left/right)
     */
    setWindDirectionX(x) {
        this.windDirection.x = Math.max(-1.0, Math.min(1.0, x));
    }

    /**
     * Set wind direction on Y-axis (up/down)
     */
    setWindDirectionY(y) {
        this.windDirection.y = Math.max(-1.0, Math.min(1.0, y));
    }

    /**
     * Set wind direction on Z-axis (forward/backward)
     */
    setWindDirectionZ(z) {
        this.windDirection.z = Math.max(-1.0, Math.min(1.0, z));
    }

    /**
     * Set complete wind direction vector
     */
    setWindDirection(x, y, z) {
        this.setWindDirectionX(x);
        this.setWindDirectionY(y);
        this.setWindDirectionZ(z);
    }

    /**
     * Get current wind direction
     */
    getWindDirection() {
        return this.windDirection.clone();
    }

    // Wind Strength Control

    /**
     * Set global wind strength
     */
    setWindStrength(strength) {
        this.windStrength = Math.max(0.0, Math.min(2.0, strength));
    }

    /**
     * Get current wind strength
     */
    getWindStrength() {
        return this.windStrength;
    }

    // Turbulence Controls

    /**
     * Set turbulence intensity
     */
    setTurbulenceIntensity(intensity) {
        this.turbulenceIntensity = Math.max(0.0, Math.min(1.0, intensity));
    }

    /**
     * Get turbulence intensity
     */
    getTurbulenceIntensity() {
        return this.turbulenceIntensity;
    }

    /**
     * Set turbulence frequency
     */
    setTurbulenceFrequency(frequency) {
        this.turbulenceFrequency = Math.max(0.1, Math.min(5.0, frequency));
    }

    /**
     * Get turbulence frequency
     */
    getTurbulenceFrequency() {
        return this.turbulenceFrequency;
    }

    // Gust Controls

    /**
     * Set gust strength
     */
    setGustStrength(strength) {
        this.gustStrength = Math.max(0.0, Math.min(2.0, strength));
    }

    /**
     * Get gust strength
     */
    getGustStrength() {
        return this.gustStrength;
    }

    /**
     * Set gust frequency
     */
    setGustFrequency(frequency) {
        this.gustFrequency = Math.max(0.1, Math.min(3.0, frequency));
    }

    /**
     * Get gust frequency
     */
    getGustFrequency() {
        return this.gustFrequency;
    }

    /**
     * Set gust duration
     */
    setGustDuration(duration) {
        this.gustDuration = Math.max(0.5, Math.min(5.0, duration));
    }

    /**
     * Get gust duration
     */
    getGustDuration() {
        return this.gustDuration;
    }

    // Wind Dampening and Responsiveness

    /**
     * Set wind dampening factor
     */
    setWindDampening(dampening) {
        this.windDampening = Math.max(0.1, Math.min(1.0, dampening));
    }

    /**
     * Get wind dampening factor
     */
    getWindDampening() {
        return this.windDampening;
    }

    /**
     * Set wind responsiveness
     */
    setWindResponsiveness(responsiveness) {
        this.windResponsiveness = Math.max(0.1, Math.min(3.0, responsiveness));
    }

    /**
     * Get wind responsiveness
     */
    getWindResponsiveness() {
        return this.windResponsiveness;
    }

    // Wind Randomness Controls

    /**
     * Set wind randomness intensity for per-strand variation
     */
    setWindRandomnessIntensity(intensity) {
        this.windRandomnessIntensity = Math.max(0.0, Math.min(1.0, intensity));
    }

    /**
     * Get wind randomness intensity
     */
    getWindRandomnessIntensity() {
        return this.windRandomnessIntensity;
    }

    // Animation Controls

    /**
     * Set animation speed
     */
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(0.1, Math.min(3.0, speed));
    }

    /**
     * Get animation speed
     */
    getAnimationSpeed() {
        return this.animationSpeed;
    }

    /**
     * Enable or disable wind simulation
     */
    setWindEnabled(enabled) {
        this.windEnabled = enabled;
        if (!enabled) {
            this.finalWindVector.set(0, 0, 0);
        }
    }

    /**
     * Get wind enabled status
     */
    getWindEnabled() {
        return this.windEnabled;
    }

    // Preset Wind Patterns

    /**
     * Apply gentle breeze preset
     */
    applyGentleBreezePreset() {
        this.setWindDirection(0.3, 0.1, 0.2);
        this.setWindStrength(0.3);
        this.setTurbulenceIntensity(0.2);
        this.setTurbulenceFrequency(1.5);
        this.setGustStrength(0.1);
        this.setGustFrequency(0.3);
        this.setWindDampening(0.9);
        this.setWindResponsiveness(0.8);
        this.setWindRandomnessIntensity(0.2);
        console.log('Applied gentle breeze wind preset');
    }

    /**
     * Apply strong wind preset
     */
    applyStrongWindPreset() {
        this.setWindDirection(0.3, 0.4, 0.7);
        this.setWindStrength(1.0);
        this.setTurbulenceIntensity(0.4);
        this.setTurbulenceFrequency(2.0);
        this.setGustStrength(0.5);
        this.setGustFrequency(0.7);
        this.setWindDampening(0.7);
        this.setWindResponsiveness(1.0);
        this.setWindRandomnessIntensity(0.3);
        console.log('Applied strong wind preset');
    }

    /**
     * Apply storm preset
     */
    applyStormPreset() {
        this.setWindDirection(0.8, 0.2, 0.6);
        this.setWindStrength(1.2);
        this.setTurbulenceIntensity(0.7);
        this.setTurbulenceFrequency(2.5);
        this.setGustStrength(0.8);
        this.setGustFrequency(1.3);
        this.setWindDampening(0.8);
        this.setWindResponsiveness(1.5);
        this.setWindRandomnessIntensity(0.5);
        console.log('Applied storm wind preset');
    }

    /**
     * Reset to calm conditions
     */
    resetToCalm() {
        this.setWindDirection(0.0, 0.0, 0.0);
        this.setWindStrength(0.0);
        this.setTurbulenceIntensity(0.0);
        this.setGustStrength(0.0);
        this.setWindDampening(0.85);
        this.setWindResponsiveness(1.0);
        this.setWindRandomnessIntensity(0.0);
        console.log('Reset wind to calm conditions');
    }

    /**
     * Get shader uniforms for wind effects
     * Returns object with all necessary uniforms for shaders
     */
    getShaderUniforms() {
        return {
            windVector: { value: this.getWindVector() },
            windStrength: { value: this.windStrength },
            windTime: { value: this.time },
            windEnabled: { value: this.windEnabled ? 1.0 : 0.0 },
            turbulenceIntensity: { value: this.turbulenceIntensity },
            gustStrength: { value: this.gustStrength },
            windRandomnessIntensity: { value: this.windRandomnessIntensity }
        };
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance statistics
     */
    getPerformanceStats() {
        return {
            ...this.performanceStats,
            qualityLevel: this.qualityLevel,
            windEnabled: this.windEnabled
        };
    }

    /**
     * Reset performance statistics
     */
    resetPerformanceStats() {
        this.performanceStats = {
            updateCount: 0,
            averageUpdateTime: 0,
            lastUpdateDuration: 0
        };
        console.log('Wind performance statistics reset');
    }

    /**
     * Get wind system status for debugging
     * @returns {Object} Complete wind system status
     */
    getSystemStatus() {
        return {
            enabled: this.windEnabled,
            direction: {
                x: this.windDirection.x,
                y: this.windDirection.y,
                z: this.windDirection.z
            },
            strength: this.windStrength,
            turbulence: {
                intensity: this.turbulenceIntensity,
                frequency: this.turbulenceFrequency
            },
            gusts: {
                strength: this.gustStrength,
                frequency: this.gustFrequency,
                duration: this.gustDuration
            },
            physics: {
                dampening: this.windDampening,
                responsiveness: this.windResponsiveness,
                animationSpeed: this.animationSpeed
            },
            performance: this.getPerformanceStats(),
            currentWindVector: {
                x: this.finalWindVector.x,
                y: this.finalWindVector.y,
                z: this.finalWindVector.z
            }
        };
    }

    /**
     * Dispose of resources
     */
    dispose() {
        // Clean up any resources if needed
        this.finalWindVector = null;
        this.cachedWindForce = null;
        this.cachedTurbulence = null;
        this.cachedGustForce = null;
        this.performanceStats = null;
        console.log('WindSimulation disposed with performance optimizations');
    }
}