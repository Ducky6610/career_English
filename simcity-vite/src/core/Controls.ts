import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG } from '../config';

export class Controls {
  public controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);

    // Prevent camera from dipping below the ground plane
    this.controls.maxPolarAngle = CONFIG.MAX_POLAR_ANGLE;
    this.controls.minDistance = CONFIG.MIN_DISTANCE;
    this.controls.maxDistance = CONFIG.MAX_DISTANCE;

    // Smooth inertia
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Default target
    this.controls.target.set(0, 0, 0);
  }

  public update(): void {
    this.controls.update();
  }

  public reset(): void {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(45, 38, 55);
    this.controls.update();
  }
}
