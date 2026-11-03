import * as THREE from 'three';
import { CONFIG } from '../config';

export class Engine {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene & Atmosphere Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BACKGROUND_COLOR);
    this.scene.fog = new THREE.FogExp2(CONFIG.FOG_COLOR, CONFIG.FOG_DENSITY);

    // 2. Camera Setup (Isometric/Perspective 45 deg tilt)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(CONFIG.DEFAULT_FOV, aspect, 0.2, 600);
    this.camera.position.set(45, 38, 55);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer with Antialias & PCFSoftShadowMap
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting System
    // Soft sky-ground hemisphere light
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.65);
    this.hemiLight.position.set(0, 100, 0);
    this.scene.add(this.hemiLight);

    // Main Directional Sun Light (Soft directional shadows over 100x100 grid)
    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    this.dirLight.position.set(65, 85, 45);
    this.dirLight.castShadow = true;

    // High fidelity shadow map
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.bias = -0.0004;
    this.dirLight.shadow.normalBias = 0.02;

    // Shadow camera bounds covering the full 100x100 grid
    const d = CONFIG.WORLD_SIZE * 0.75; // ~75
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 260;

    this.scene.add(this.dirLight);

    // 5. Handle Resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public getDrawCalls(): number {
    return this.renderer.info.render.calls;
  }
}
