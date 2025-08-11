import { GUI } from 'three/addons/libs/lil-gui.module.min.js'

/**
 * Minimal ParameterPanel
 * Provides only a model selection dropdown and a callback on selection.
 */
export class ParameterPanel {
  constructor(modelLoader, furRenderer = null) {
    this.modelLoader = modelLoader
    this.furRenderer = furRenderer
    this.gui = new GUI({ title: 'Fur Rendering Controls' })
    this.controllers = {}
    this.onModelChanged = null

    this.setupInterface()
  }

  setupInterface() {
    this.setupModelControls()
    if (this.furRenderer) {
      this.setupFurControls()
    }
  }

  setupModelControls() {
    const folder = this.gui.addFolder('Model')
    const available = this.modelLoader.getAvailableModels()
    const modelNames = available.map((m, idx) => m.name ?? `Model ${idx}`)

    const state = { model: modelNames[0] ?? 'Sphere' }

    this.controllers.model = folder
      .add(state, 'model', modelNames)
      .name('Choose Model')
      .onChange(async (name) => {
        const selected = available.find((m) => m.name === name)
        if (!this.onModelChanged) return

        // Pass name or index to FurApp; FurApp will call ModelLoader.loadModel
        if (selected) {
          this.onModelChanged(selected.name)
        } else {
          const idx = modelNames.indexOf(name)
          this.onModelChanged(idx >= 0 ? idx : 0)
        }
      })

    folder.open()
  }

  setupFurControls() {
    const furFolder = this.gui.addFolder('Fur Properties')

    // Global fur color control
    const furState = {
      furColor: '#e8f7f7', // Default light cyan fur color
      lightIntensity: 1.0,
      ambientIntensity: 0.25
    }

    // Fur color picker with immediate feedback
    this.controllers.furColor = furFolder
      .addColor(furState, 'furColor')
      .name('Fur Color')
      .onChange((color) => {
        if (this.furRenderer) {
          // Immediate color update for responsive feedback
          this.furRenderer.setFurColor(color)
        }
      })
      .onFinishChange((color) => {
        // Additional processing when color selection is complete
        console.log('Fur color changed to:', color)
      })

    // Add fur style presets
    this.setupFurStylePresets()

    // Light intensity control
    this.controllers.lightIntensity = furFolder
      .add(furState, 'lightIntensity', 0.0, 3.0, 0.1)
      .name('Light Intensity')
      .onChange((intensity) => {
        if (this.furRenderer) {
          this.furRenderer.setLightIntensity(intensity)
        }
      })

    // Ambient light intensity control
    this.controllers.ambientIntensity = furFolder
      .add(furState, 'ambientIntensity', 0.0, 1.0, 0.05)
      .name('Ambient Light')
      .onChange((intensity) => {
        if (this.furRenderer) {
          // Convert intensity to RGB color (grayscale)
          const ambientColor = intensity * 0x404040
          this.furRenderer.setAmbientColor(ambientColor)
        }
      })

    furFolder.open()

    // Fin Controls
    const finFolder = this.gui.addFolder('Fin Rendering')

    const finState = {
      finEnabled: true,
      finLength: 0.08,
      finOpacity: 0.9,
      silhouetteSensitivity: 1.0,
      maxFinCount: 1000,
      // Fin tapering parameters
      finTaperingEnabled: true,
      finTaperingIntensity: 0.5,
      finTaperingCurve: 'linear',
      finTaperingMethod: 'hybrid',
      // Debug visualization
      wireframeMode: false
    }

    // Fin enable/disable toggle
    this.controllers.finEnabled = finFolder
      .add(finState, 'finEnabled')
      .name('Enable Fins')
      .onChange((enabled) => {
        if (this.furRenderer) {
          this.furRenderer.setFinEnabled(enabled)
        }
      })

    // Fin length control
    this.controllers.finLength = finFolder
      .add(finState, 'finLength', 0.0, 0.25, 0.01)
      .name('Fin Length')
      .onChange((length) => {
        if (this.furRenderer) {
          this.furRenderer.setFinLength(length)
        }
      })

    // Fin opacity control
    this.controllers.finOpacity = finFolder
      .add(finState, 'finOpacity', 0.0, 1.0, 0.05)
      .name('Fin Opacity')
      .onChange((opacity) => {
        if (this.furRenderer) {
          this.furRenderer.setFinOpacity(opacity)
        }
      })

    // Silhouette sensitivity control
    this.controllers.silhouetteSensitivity = finFolder
      .add(finState, 'silhouetteSensitivity', 0.1, 4.0, 0.1)
      .name('Silhouette Sensitivity')
      .onChange((sensitivity) => {
        if (this.furRenderer) {
          this.furRenderer.setSilhouetteSensitivity(sensitivity)
        }
      })

    // Fin count control for performance
    this.controllers.maxFinCount = finFolder
      .add(finState, 'maxFinCount', 1000, 50000, 100)
      .name('Max Fin Count')
      .onChange((count) => {
        if (this.furRenderer) {
          this.furRenderer.setMaxFinCount(count)
        }
      })

    // Wireframe mode toggle for debugging
    this.controllers.finWireframeMode = finFolder
      .add(finState, 'wireframeMode')
      .name('Wireframe Mode')
      .onChange((enabled) => {
        if (this.furRenderer) {
          this.furRenderer.setFinWireframeMode(enabled)
        }
      })

    // Fin Tapering Controls
    const finTaperingFolder = finFolder.addFolder('Fin Tapering')

    // Fin tapering enable/disable toggle
    this.controllers.finTaperingEnabled = finTaperingFolder
      .add(finState, 'finTaperingEnabled')
      .name('Enable Fin Tapering')
      .onChange((enabled) => {
        if (this.furRenderer) {
          this.furRenderer.setFinTaperingEnabled(enabled)
        }
      })

    // Fin tapering intensity control
    this.controllers.finTaperingIntensity = finTaperingFolder
      .add(finState, 'finTaperingIntensity', 0.0, 1.0, 0.05)
      .name('Fin Tapering Intensity')
      .onChange((intensity) => {
        if (this.furRenderer) {
          this.furRenderer.setFinTaperingIntensity(intensity)
        }
      })

    // Fin tapering curve selection
    this.controllers.finTaperingCurve = finTaperingFolder
      .add(finState, 'finTaperingCurve', ['linear', 'quadratic', 'exponential'])
      .name('Fin Tapering Curve')
      .onChange((curve) => {
        if (this.furRenderer) {
          this.furRenderer.setFinTaperingCurve(curve)
        }
      })

    // Fin tapering method selection
    this.controllers.finTaperingMethod = finTaperingFolder
      .add(finState, 'finTaperingMethod', ['centroid', 'normal', 'hybrid'])
      .name('Fin Tapering Method')
      .onChange((method) => {
        if (this.furRenderer) {
          this.furRenderer.setFinTaperingMethod(method)
        }
      })

    // Fin tapering presets
    const finTaperingPresets = {
      none: () => {
        if (this.furRenderer) {
          this.furRenderer.applyFinTaperingPreset('none')
          this.updateFinTaperingControlsFromRenderer()
        }
      },
      subtle: () => {
        if (this.furRenderer) {
          this.furRenderer.applyFinTaperingPreset('subtle')
          this.updateFinTaperingControlsFromRenderer()
        }
      },
      moderate: () => {
        if (this.furRenderer) {
          this.furRenderer.applyFinTaperingPreset('moderate')
          this.updateFinTaperingControlsFromRenderer()
        }
      },
      strong: () => {
        if (this.furRenderer) {
          this.furRenderer.applyFinTaperingPreset('strong')
          this.updateFinTaperingControlsFromRenderer()
        }
      }
    }

    const finTaperingPresetsFolder = finTaperingFolder.addFolder('Fin Tapering Presets')
    finTaperingPresetsFolder.add(finTaperingPresets, 'none').name('None')
    finTaperingPresetsFolder.add(finTaperingPresets, 'subtle').name('Weak')
    finTaperingPresetsFolder.add(finTaperingPresets, 'moderate').name('Medium')
    finTaperingPresetsFolder.add(finTaperingPresets, 'strong').name('Strong')

    finTaperingFolder.close()
    finFolder.open()

    // Shell Controls
    const shellFolder = this.gui.addFolder('Shell Rendering')

    const shellState = {
      shellEnabled: true,
      shellCount: 12,
      shellSpacing: 0.015,
      shellOpacity: 0.7,
      shellDensity: 1.2,
      shellLayerOpacity: 1.0,
      maxShellDistance: 0.15,
      // Tapering parameters
      taperingEnabled: true,
      taperingIntensity: 0.5,
      taperingCurve: 'linear',
      taperingMethod: 'hybrid',
      // Debug visualization
      wireframeMode: false
    }

    // Shell enable/disable toggle
    this.controllers.shellEnabled = shellFolder
      .add(shellState, 'shellEnabled')
      .name('Enable Shells')
      .onChange((enabled) => {
        if (this.furRenderer) {
          this.furRenderer.setShellEnabled(enabled)
        }
      })

    // Shell count control (8-32 layers)
    this.controllers.shellCount = shellFolder
      .add(shellState, 'shellCount', 8, 32, 1)
      .name('Shell Count')
      .onChange((count) => {
        if (this.furRenderer) {
          this.furRenderer.setShellCount(count)
        }
      })

    // Shell spacing control
    this.controllers.shellSpacing = shellFolder
      .add(shellState, 'shellSpacing', 0.001, 0.01, 0.001)
      .name('Shell Spacing')
      .onChange((spacing) => {
        if (this.furRenderer) {
          this.furRenderer.setShellSpacing(spacing)
        }
      })

    // Shell opacity control
    this.controllers.shellOpacity = shellFolder
      .add(shellState, 'shellOpacity', 0.0, 1.0, 0.05)
      .name('Shell Opacity')
      .onChange((opacity) => {
        if (this.furRenderer) {
          this.furRenderer.setShellOpacity(opacity)
        }
      })

    // Shell density control
    this.controllers.shellDensity = shellFolder
      .add(shellState, 'shellDensity', 0.1, 3.0, 0.1)
      .name('Shell Density')
      .onChange((density) => {
        if (this.furRenderer) {
          this.furRenderer.setShellDensity(density)
        }
      })

    // Shell layer opacity multiplier
    this.controllers.shellLayerOpacity = shellFolder
      .add(shellState, 'shellLayerOpacity', 0.0, 1.0, 0.05)
      .name('Layer Opacity')
      .onChange((opacity) => {
        if (this.furRenderer) {
          this.furRenderer.setShellLayerOpacity(opacity)
        }
      })

    // Maximum shell distance control
    this.controllers.maxShellDistance = shellFolder
      .add(shellState, 'maxShellDistance', 0.01, 0.25, 0.005)
      .name('Max Distance')
      .onChange((distance) => {
        if (this.furRenderer) {
          this.furRenderer.setMaxShellDistance(distance)
        }
      })

    // Wireframe mode toggle for debugging
    this.controllers.wireframeMode = shellFolder
      .add(shellState, 'wireframeMode')
      .name('Wireframe Mode')
      .onChange((enabled) => {
        if (this.furRenderer) {
          this.furRenderer.setShellWireframeMode(enabled)
        }
      })

    // Shell Tapering Controls
    const taperingFolder = shellFolder.addFolder('Shell Tapering')

    // Tapering enable/disable toggle
    this.controllers.taperingEnabled = taperingFolder
      .add(shellState, 'taperingEnabled')
      .name('Enable Tapering')
      .onChange((enabled) => {
        if (this.furRenderer) {
          this.furRenderer.setTaperingEnabled(enabled)
        }
      })

    // Tapering intensity control
    this.controllers.taperingIntensity = taperingFolder
      .add(shellState, 'taperingIntensity', 0.0, 1.0, 0.05)
      .name('Tapering Intensity')
      .onChange((intensity) => {
        if (this.furRenderer) {
          this.furRenderer.setTaperingIntensity(intensity)
        }
      })

    // Tapering curve selection
    this.controllers.taperingCurve = taperingFolder
      .add(shellState, 'taperingCurve', ['linear', 'quadratic', 'exponential'])
      .name('Tapering Curve')
      .onChange((curve) => {
        if (this.furRenderer) {
          this.furRenderer.setTaperingCurve(curve)
        }
      })

    // Tapering method selection
    this.controllers.taperingMethod = taperingFolder
      .add(shellState, 'taperingMethod', ['centroid', 'normal', 'hybrid'])
      .name('Tapering Method')
      .onChange((method) => {
        if (this.furRenderer) {
          this.furRenderer.setTaperingMethod(method)
        }
      })

    // Tapering presets
    const taperingPresets = {
      none: () => {
        if (this.furRenderer) {
          this.furRenderer.applyTaperingPreset('none')
          this.updateTaperingControlsFromRenderer()
        }
      },
      subtle: () => {
        if (this.furRenderer) {
          this.furRenderer.applyTaperingPreset('subtle')
          this.updateTaperingControlsFromRenderer()
        }
      },
      moderate: () => {
        if (this.furRenderer) {
          this.furRenderer.applyTaperingPreset('moderate')
          this.updateTaperingControlsFromRenderer()
        }
      },
      strong: () => {
        if (this.furRenderer) {
          this.furRenderer.applyTaperingPreset('strong')
          this.updateTaperingControlsFromRenderer()
        }
      }
    }

    const taperingPresetsFolder = taperingFolder.addFolder('Tapering Presets')
    taperingPresetsFolder.add(taperingPresets, 'none').name('None')
    taperingPresetsFolder.add(taperingPresets, 'subtle').name('Weak')
    taperingPresetsFolder.add(taperingPresets, 'moderate').name('Medium')
    taperingPresetsFolder.add(taperingPresets, 'strong').name('Strong')

    taperingFolder.close()
    shellFolder.open()

    // Wind Simulation Controls
    const windFolder = this.gui.addFolder('Wind Simulation')

    const windState = {
      windEnabled: true,
      windDirectionX: 0.8,
      windDirectionY: 0.2,
      windDirectionZ: 0.6,
      windStrength: 1.2,
      turbulenceIntensity: 0.5,
      turbulenceFrequency: 2.5,
      gustStrength: 0.8,
      gustFrequency: 0.8,
      gustDuration: 2.0,
      windDampening: 0.7,
      windResponsiveness: 1.5,
      animationSpeed: 1.0,
      windRandomnessIntensity: 0.3
    }

    // Wind enable/disable toggle
    this.controllers.windEnabled = windFolder
      .add(windState, 'windEnabled')
      .name('Enable Wind')
      .onChange((enabled) => {
        if (this.furRenderer) {
          this.furRenderer.setWindEnabled(enabled)
        }
      })

    // Wind Direction Controls (Three-Axis)
    const windPropertiesFolder = windFolder.addFolder('Wind Properties')

    // X-axis control (left/right)
    this.controllers.windDirectionX = windPropertiesFolder
      .add(windState, 'windDirectionX', -1.0, 1.0, 0.05)
      .name('X-Axis (Left/Right)')
      .onChange((x) => {
        if (this.furRenderer) {
          this.furRenderer.setWindDirectionX(x)
        }
      })

    // Y-axis control (up/down)
    this.controllers.windDirectionY = windPropertiesFolder
      .add(windState, 'windDirectionY', -1.0, 1.0, 0.05)
      .name('Y-Axis (Up/Down)')
      .onChange((y) => {
        if (this.furRenderer) {
          this.furRenderer.setWindDirectionY(y)
        }
      })

    // Z-axis control (forward/backward)
    this.controllers.windDirectionZ = windPropertiesFolder
      .add(windState, 'windDirectionZ', -1.0, 1.0, 0.05)
      .name('Z-Axis (Forward/Back)')
      .onChange((z) => {
        if (this.furRenderer) {
          this.furRenderer.setWindDirectionZ(z)
        }
      })

    windPropertiesFolder.close()

    // Wind Strength Control
    this.controllers.windStrength = windPropertiesFolder
      .add(windState, 'windStrength', 0.0, 2.0, 0.05)
      .name('Wind Magnitude')
      .onChange((strength) => {
        if (this.furRenderer) {
          this.furRenderer.setWindStrength(strength)
        }
      })

    // Wind Randomness Control
    this.controllers.windRandomnessIntensity = windPropertiesFolder
      .add(windState, 'windRandomnessIntensity', 0.0, 1.0, 0.05)
      .name('Wind Randomness')
      .onChange((intensity) => {
        if (this.furRenderer) {
          this.furRenderer.setWindRandomnessIntensity(intensity)
        }
      })

    // Turbulence Controls
    const turbulenceFolder = windFolder.addFolder('Turbulence')

    this.controllers.turbulenceIntensity = turbulenceFolder
      .add(windState, 'turbulenceIntensity', 0.0, 1.0, 0.05)
      .name('Turbulence Intensity')
      .onChange((intensity) => {
        if (this.furRenderer) {
          this.furRenderer.setTurbulenceIntensity(intensity)
        }
      })

    this.controllers.turbulenceFrequency = turbulenceFolder
      .add(windState, 'turbulenceFrequency', 0.1, 5.0, 0.1)
      .name('Turbulence Frequency')
      .onChange((frequency) => {
        if (this.furRenderer) {
          this.furRenderer.setTurbulenceFrequency(frequency)
        }
      })

    turbulenceFolder.close()

    // Gust Controls
    const gustFolder = windFolder.addFolder('Wind Gusts')

    this.controllers.gustStrength = gustFolder
      .add(windState, 'gustStrength', 0.0, 2.0, 0.05)
      .name('Gust Strength')
      .onChange((strength) => {
        if (this.furRenderer) {
          this.furRenderer.setGustStrength(strength)
        }
      })

    this.controllers.gustFrequency = gustFolder
      .add(windState, 'gustFrequency', 0.1, 3.0, 0.1)
      .name('Gust Frequency')
      .onChange((frequency) => {
        if (this.furRenderer) {
          this.furRenderer.setGustFrequency(frequency)
        }
      })

    this.controllers.gustDuration = gustFolder
      .add(windState, 'gustDuration', 0.5, 5.0, 0.1)
      .name('Gust Duration')
      .onChange((duration) => {
        if (this.furRenderer) {
          this.furRenderer.setGustDuration(duration)
        }
      })

    gustFolder.close()

    // Wind Physics Controls
    const windPhysicsFolder = windFolder.addFolder('Wind Physics')

    this.controllers.windDampening = windPhysicsFolder
      .add(windState, 'windDampening', 0.1, 1.0, 0.05)
      .name('Wind Dampening')
      .onChange((dampening) => {
        if (this.furRenderer) {
          this.furRenderer.setWindDampening(dampening)
        }
      })

    this.controllers.windResponsiveness = windPhysicsFolder
      .add(windState, 'windResponsiveness', 0.1, 3.0, 0.1)
      .name('Wind Responsiveness')
      .onChange((responsiveness) => {
        if (this.furRenderer) {
          this.furRenderer.setWindResponsiveness(responsiveness)
        }
      })

    this.controllers.animationSpeed = windPhysicsFolder
      .add(windState, 'animationSpeed', 0.1, 3.0, 0.1)
      .name('Animation Speed')
      .onChange((speed) => {
        if (this.furRenderer) {
          this.furRenderer.setWindAnimationSpeed(speed)
        }
      })

    windPhysicsFolder.close()

    // Wind Presets
    const windPresetsFolder = windFolder.addFolder('Wind Presets')

    const presetActions = {
      gentleBreeze: () => {
        if (this.furRenderer) {
          this.furRenderer.applyGentleBreezePreset()
          this.updateWindControlsFromRenderer()
        }
      },
      strongWind: () => {
        if (this.furRenderer) {
          this.furRenderer.applyStrongWindPreset()
          this.updateWindControlsFromRenderer()
        }
      },
      storm: () => {
        if (this.furRenderer) {
          this.furRenderer.applyStormPreset()
          this.updateWindControlsFromRenderer()
        }
      },
      calm: () => {
        if (this.furRenderer) {
          this.furRenderer.resetWindToCalm()
          this.updateWindControlsFromRenderer()
        }
      }
    }

    windPresetsFolder.add(presetActions, 'calm').name('None')
    windPresetsFolder.add(presetActions, 'gentleBreeze').name('Weak')
    windPresetsFolder.add(presetActions, 'strongWind').name('Medium')
    windPresetsFolder.add(presetActions, 'storm').name('Strong')

    windPresetsFolder.open()
    windFolder.open()
  }

  /**
   * Setup fur style presets for quick configuration
   */
  setupFurStylePresets() {
    const presetsFolder = this.gui.addFolder('Fur Style Presets')

    const presetActions = {
      shortFur: () => {
        this.applyFurPreset({
          shellCount: 16,
          shellSpacing: 0.001,
          maxShellDistance: 0.03,
          shellOpacity: 0.7,
          shellDensity: 2.0,
          finLength: 0.01,
          finOpacity: 0.5,
          taperingEnabled: true,
          taperingIntensity: 0.5,
          taperingCurve: 'linear',
          taperingMethod: 'hybrid'
        })
      },
      mediumFur: () => {
        this.applyFurPreset({
          shellCount: 24,
          shellSpacing: 0.005,
          maxShellDistance: 0.1,
          shellOpacity: 0.6,
          shellDensity: 2.0,
          finLength: 0.05,
          finOpacity: 0.5,
          taperingEnabled: true,
          taperingIntensity: 0.7,
          taperingCurve: 'quadratic',
          taperingMethod: 'hybrid'
        })
      },
      longFur: () => {
        this.applyFurPreset({
          shellCount: 32,
          shellSpacing: 0.01,
          maxShellDistance: 0.25,
          shellOpacity: 0.5,
          shellDensity: 0.9,
          finLength: 0.1,
          finOpacity: 0.3,
          taperingEnabled: true,
          taperingIntensity: 0.8,
          taperingCurve: 'exponential',
          taperingMethod: 'centroid'
        })
      },
      resetToDefault: () => {
        this.applyFurPreset({
          shellCount: 16,
          shellSpacing: 0.01,
          maxShellDistance: 0.05,
          shellOpacity: 0.7,
          shellDensity: 2.0,
          finLength: 0.01,
          finOpacity: 0.5,
          taperingEnabled: true,
          taperingIntensity: 0.9,
          taperingCurve: 'linear',
          taperingMethod: 'hybrid'
        })
      }
    }

    presetsFolder.add(presetActions, 'shortFur').name('Short Fur')
    presetsFolder.add(presetActions, 'mediumFur').name('Medium Fur')
    presetsFolder.add(presetActions, 'longFur').name('Long Fur')

    presetsFolder.open()
  }

  /**
   * Apply a fur preset configuration
   * @param {Object} preset - Preset configuration object
   */
  applyFurPreset(preset) {
    if (!this.furRenderer) return

    // Apply shell settings
    if (preset.shellCount !== undefined) {
      this.furRenderer.setShellCount(preset.shellCount)
      if (this.controllers.shellCount) {
        this.controllers.shellCount.setValue(preset.shellCount)
      }
    }

    if (preset.shellSpacing !== undefined) {
      this.furRenderer.setShellSpacing(preset.shellSpacing)
      if (this.controllers.shellSpacing) {
        this.controllers.shellSpacing.setValue(preset.shellSpacing)
      }
    }

    if (preset.maxShellDistance !== undefined) {
      this.furRenderer.setMaxShellDistance(preset.maxShellDistance)
      if (this.controllers.maxShellDistance) {
        this.controllers.maxShellDistance.setValue(preset.maxShellDistance)
      }
    }

    if (preset.shellOpacity !== undefined) {
      this.furRenderer.setShellOpacity(preset.shellOpacity)
      if (this.controllers.shellOpacity) {
        this.controllers.shellOpacity.setValue(preset.shellOpacity)
      }
    }

    if (preset.shellDensity !== undefined) {
      this.furRenderer.setShellDensity(preset.shellDensity)
      if (this.controllers.shellDensity) {
        this.controllers.shellDensity.setValue(preset.shellDensity)
      }
    }

    // Apply fin settings
    if (preset.finLength !== undefined) {
      this.furRenderer.setFinLength(preset.finLength)
      if (this.controllers.finLength) {
        this.controllers.finLength.setValue(preset.finLength)
      }
    }

    if (preset.finOpacity !== undefined) {
      this.furRenderer.setFinOpacity(preset.finOpacity)
      if (this.controllers.finOpacity) {
        this.controllers.finOpacity.setValue(preset.finOpacity)
      }
    }

    // Apply tapering settings
    if (preset.taperingEnabled !== undefined) {
      this.furRenderer.setTaperingEnabled(preset.taperingEnabled)
      if (this.controllers.taperingEnabled) {
        this.controllers.taperingEnabled.setValue(preset.taperingEnabled)
      }
    }

    if (preset.taperingIntensity !== undefined) {
      this.furRenderer.setTaperingIntensity(preset.taperingIntensity)
      if (this.controllers.taperingIntensity) {
        this.controllers.taperingIntensity.setValue(preset.taperingIntensity)
      }
    }

    if (preset.taperingCurve !== undefined) {
      this.furRenderer.setTaperingCurve(preset.taperingCurve)
      if (this.controllers.taperingCurve) {
        this.controllers.taperingCurve.setValue(preset.taperingCurve)
      }
    }

    if (preset.taperingMethod !== undefined) {
      this.furRenderer.setTaperingMethod(preset.taperingMethod)
      if (this.controllers.taperingMethod) {
        this.controllers.taperingMethod.setValue(preset.taperingMethod)
      }
    }

    console.log('Applied fur preset:', preset)
  }



  /**
   * Update wind control values from the renderer
   * Used when applying presets to sync UI with actual values
   */
  updateWindControlsFromRenderer() {
    if (!this.furRenderer) return

    try {
      const windDirection = this.furRenderer.getWindDirection()

      if (this.controllers.windDirectionX) {
        this.controllers.windDirectionX.setValue(windDirection.x)
      }
      if (this.controllers.windDirectionY) {
        this.controllers.windDirectionY.setValue(windDirection.y)
      }
      if (this.controllers.windDirectionZ) {
        this.controllers.windDirectionZ.setValue(windDirection.z)
      }
      if (this.controllers.windStrength) {
        this.controllers.windStrength.setValue(this.furRenderer.getWindStrength())
      }
      if (this.controllers.turbulenceIntensity) {
        this.controllers.turbulenceIntensity.setValue(this.furRenderer.getTurbulenceIntensity())
      }
      if (this.controllers.turbulenceFrequency) {
        this.controllers.turbulenceFrequency.setValue(this.furRenderer.getTurbulenceFrequency())
      }
      if (this.controllers.gustStrength) {
        this.controllers.gustStrength.setValue(this.furRenderer.getGustStrength())
      }
      if (this.controllers.gustFrequency) {
        this.controllers.gustFrequency.setValue(this.furRenderer.getGustFrequency())
      }
      if (this.controllers.gustDuration) {
        this.controllers.gustDuration.setValue(this.furRenderer.getGustDuration())
      }
      if (this.controllers.windDampening) {
        this.controllers.windDampening.setValue(this.furRenderer.getWindDampening())
      }
      if (this.controllers.windResponsiveness) {
        this.controllers.windResponsiveness.setValue(this.furRenderer.getWindResponsiveness())
      }
      if (this.controllers.animationSpeed) {
        this.controllers.animationSpeed.setValue(this.furRenderer.getWindAnimationSpeed())
      }
      if (this.controllers.windEnabled) {
        this.controllers.windEnabled.setValue(this.furRenderer.getWindEnabled())
      }
      if (this.controllers.windRandomnessIntensity) {
        this.controllers.windRandomnessIntensity.setValue(this.furRenderer.getWindRandomnessIntensity())
      }
    } catch (error) {
      console.warn('Error updating wind controls from renderer:', error)
    }
  }

  /**
   * Update tapering control values from the renderer
   * Used when applying presets to sync UI with actual values
   */
  updateTaperingControlsFromRenderer() {
    if (!this.furRenderer) return

    try {
      if (this.controllers.taperingEnabled) {
        this.controllers.taperingEnabled.setValue(this.furRenderer.getTaperingEnabled())
      }
      if (this.controllers.taperingIntensity) {
        this.controllers.taperingIntensity.setValue(this.furRenderer.getTaperingIntensity())
      }
      if (this.controllers.taperingCurve) {
        this.controllers.taperingCurve.setValue(this.furRenderer.getTaperingCurve())
      }
      if (this.controllers.taperingMethod) {
        this.controllers.taperingMethod.setValue(this.furRenderer.getTaperingMethod())
      }
    } catch (error) {
      console.warn('Error updating tapering controls from renderer:', error)
    }
  }

  /**
   * Update fin tapering control values from the renderer
   * Used when applying presets to sync UI with actual values
   */
  updateFinTaperingControlsFromRenderer() {
    if (!this.furRenderer) return

    try {
      if (this.controllers.finTaperingEnabled) {
        this.controllers.finTaperingEnabled.setValue(this.furRenderer.getFinTaperingEnabled())
      }
      if (this.controllers.finTaperingIntensity) {
        this.controllers.finTaperingIntensity.setValue(this.furRenderer.getFinTaperingIntensity())
      }
      if (this.controllers.finTaperingCurve) {
        this.controllers.finTaperingCurve.setValue(this.furRenderer.getFinTaperingCurve())
      }
      if (this.controllers.finTaperingMethod) {
        this.controllers.finTaperingMethod.setValue(this.furRenderer.getFinTaperingMethod())
      }
    } catch (error) {
      console.warn('Error updating fin tapering controls from renderer:', error)
    }
  }



  // Consumer sets a callback(nameOrIndex)
  setModelChangeCallback(cb) {
    this.onModelChanged = cb
  }

  dispose() {
    try {
      // Destroy GUI
      this.gui.destroy()

      // Clear references
      this.controllers = {}
      this.furRenderer = null
      this.modelLoader = null

      console.log('ParameterPanel disposed')
    } catch (error) {
      console.warn('Error disposing ParameterPanel:', error)
    }
  }
}