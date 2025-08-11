import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

/**
 * ModelLoader - Handles loading of DRACO compressed meshes
 * Automatically detects file format and applies appropriate loader
 */
export class ModelLoader {
	constructor() {
		this.dracoLoader = new DRACOLoader()

		// Configure DRACO loader
		this.dracoLoader.setDecoderPath('./imports/three@0.178.0/examples/jsm/libs/draco/')

		this.loadingManager = new THREE.LoadingManager()
		this.availableModels = []
		this.currentModel = null

		this.setupLoadingManager()
		this.discoverModels()
	}

	/**
	 * Setup loading manager with progress callbacks
	 */
	setupLoadingManager() {
		this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
			console.log('Started loading file: ' + url)
		}

		this.loadingManager.onLoad = () => {
			console.log('Loading complete!')
		}

		this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
			console.log('Loading file: ' + url + ' (' + itemsLoaded + ' of ' + itemsTotal + ' files)')
		}

		this.loadingManager.onError = (url) => {
			console.error('There was an error loading ' + url)
		}
	}

	/**
	 * Discover available models in the models directory
	 */
	async discoverModels() {
		// Default models (built-in geometries)
		this.availableModels = [
			{
				name: 'Sphere',
				type: 'builtin',
				geometry: 'sphere'
			},
			{
				name: 'Cube',
				type: 'builtin',
				geometry: 'cube'
			},
			{
				name: 'Torus',
				type: 'builtin',
				geometry: 'torus'
			},
			{
				name: 'Bunny',
				type: 'draco',
				path: './models/bunny.drc'
			},
			{
				name: 'Bunny (low poly)',
				type: 'draco',
				path: './models/bunny-lp.drc'
			},
			{
				name: 'Duck',
				type: 'draco',
				path: './models/duck.drc'
			},
			{
				name: 'Fox',
				type: 'draco',
				path: './models/fox.drc'
			}
		]
	}

	/**
	 * Get list of available models
	 */
	getAvailableModels() {
		return this.availableModels
	}

	/**
	 * Load a model by name or index
	 */
	async loadModel(modelIdentifier) {
		let model

		if (typeof modelIdentifier === 'number') {
			model = this.availableModels[modelIdentifier]
		} else {
			model = this.availableModels.find(m => m.name === modelIdentifier)
		}

		if (!model) {
			throw new Error(`Model not found: ${modelIdentifier}`)
		}

		console.log('Loading model:', model.name)

		try {
			let mesh

			if (model.type === 'builtin') {
				mesh = this.createBuiltinGeometry(model.geometry)
			} else if (model.type === 'draco') {
				mesh = await this.loadDRACOModel(model.path)
			} else {
				throw new Error(`Unsupported model type: ${model.type}`)
			}

			// Ensure the mesh has proper attributes for fur rendering
			this.prepareMeshForFur(mesh)

			this.currentModel = model
			return mesh

		} catch (error) {
			console.error('Error loading model:', error)
			throw error
		}
	}

	/**
	 * Create built-in geometry
	 */
	createBuiltinGeometry(geometryType) {
		let geometry

		switch (geometryType) {
			case 'cube':
				geometry = new THREE.BoxGeometry(1, 1, 1)
				break
			case 'torus':
				geometry = new THREE.TorusGeometry(1, 0.3, 32, 100)
				break
			case 'sphere':
			default:
				geometry = new THREE.SphereGeometry(1, 128, 128)
		}

		// Ensure we have tangent attributes
		geometry.computeTangents()

		const material = new THREE.MeshStandardMaterial({
			color: 0x8B4513,
			roughness: 0.8,
			metalness: 0.1
		})

		const mesh = new THREE.Mesh(geometry, material)
		mesh.castShadow = true
		mesh.receiveShadow = true

		return mesh
	}

	/**
	 * Load DRACO compressed model
	 */
	loadDRACOModel(path) {
		return new Promise((resolve, reject) => {
			this.dracoLoader.load(
				path,
				(geometry) => {
					const material = new THREE.MeshStandardMaterial({
						color: 0x8B4513,
						roughness: 0.8,
						metalness: 0.1
					})

					const mesh = new THREE.Mesh(geometry, material)
					mesh.castShadow = true
					mesh.receiveShadow = true

					resolve(mesh)
				},
				(progress) => {
					console.log('DRACO loading progress:', progress)
				},
				(error) => {
					reject(error)
				}
			)
		})
	}

	/**
	 * Prepare mesh for fur rendering
	 */
	prepareMeshForFur(mesh) {
		const geometry = mesh.geometry

		// Ensure we have position and normal attributes
		if (!geometry.attributes.position) {
			throw new Error('Geometry missing position attribute')
		}

		if (!geometry.attributes.normal) {
			geometry.computeVertexNormals()
		}

		// Ensure we have UV coordinates
		if (!geometry.attributes.uv) {
			// Generate basic UV coordinates
			const positions = geometry.attributes.position
			const uvs = []

			for (let i = 0; i < positions.count; i++) {
				const x = positions.getX(i)
				const y = positions.getY(i)
				const z = positions.getZ(i)

				// Simple spherical UV mapping
				const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI)
				const v = 0.5 - Math.asin(y) / Math.PI

				uvs.push(u, v)
			}

			geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
		}

		// Ensure we have tangent attributes for hair lighting
		if (!geometry.attributes.tangent) {
			geometry.computeTangents()
		}

		// Center and scale the geometry
		geometry.computeBoundingBox()
		const box = geometry.boundingBox
		const center = box.getCenter(new THREE.Vector3())
		const size = box.getSize(new THREE.Vector3())
		const maxDimension = Math.max(size.x, size.y, size.z)

		// Center the geometry
		geometry.translate(-center.x, -center.y, -center.z)

		// Scale to unit size
		if (maxDimension > 0) {
			geometry.scale(1 / maxDimension, 1 / maxDimension, 1 / maxDimension)
		}
	}

	/**
	 * Get current model info
	 */
	getCurrentModel() {
		return this.currentModel
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		if (this.dracoLoader) {
			this.dracoLoader.dispose()
		}
	}
}