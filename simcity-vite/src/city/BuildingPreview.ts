import * as THREE from 'three';
import { CONFIG } from '../config';
import { MathUtils } from '../utils/MathUtils';

export class BuildingPreview {
  public mesh: THREE.Mesh;
  public edges: THREE.LineSegments;
  public group: THREE.Group;
  private validMaterial: THREE.MeshBasicMaterial;
  private invalidMaterial: THREE.MeshBasicMaterial;
  private validEdgeMat: THREE.LineBasicMaterial;
  private invalidEdgeMat: THREE.LineBasicMaterial;
  private isVisible: boolean = false;
  private currentGridX: number = -1;
  private currentGridZ: number = -1;

  constructor() {
    this.group = new THREE.Group();
    const w = CONFIG.CELL_SIZE * CONFIG.BUILDING_GAP_RATIO;
    const previewHeight = 3.0; // Default preview box height
    const geometry = new THREE.BoxGeometry(w, previewHeight, w);

    // Green semi-transparent material for valid cell
    this.validMaterial = new THREE.MeshBasicMaterial({
      color: 0x22c55e, // Emerald green
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    });

    // Red semi-transparent material for occupied/invalid cell
    this.invalidMaterial = new THREE.MeshBasicMaterial({
      color: 0xef4444, // Bright red
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, this.validMaterial);
    this.mesh.position.y = previewHeight / 2;

    // Glowing wireframe outline for SimCity holographic blueprint effect
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    this.validEdgeMat = new THREE.LineBasicMaterial({
      color: 0x86efac,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    this.invalidEdgeMat = new THREE.LineBasicMaterial({
      color: 0xfca5a5,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });

    this.edges = new THREE.LineSegments(edgesGeo, this.validEdgeMat);
    this.edges.position.y = previewHeight / 2;

    this.group.add(this.mesh);
    this.group.add(this.edges);
    this.group.visible = false;
  }

  public get visible(): boolean {
    return this.isVisible;
  }

  public get gridPos(): { gx: number; gz: number } {
    return { gx: this.currentGridX, gz: this.currentGridZ };
  }

  /**
   * Update position snapped to grid cell and set valid/occupied material
   */
  public updateSnap(gx: number, gz: number, isOccupied: boolean): void {
    this.currentGridX = gx;
    this.currentGridZ = gz;
    const { worldX, worldZ } = MathUtils.gridToWorld(gx, gz);

    this.group.position.set(worldX, 0, worldZ);

    if (isOccupied) {
      this.mesh.material = this.invalidMaterial;
      this.edges.material = this.invalidEdgeMat;
    } else {
      this.mesh.material = this.validMaterial;
      this.edges.material = this.validEdgeMat;
    }

    if (!this.isVisible) {
      this.isVisible = true;
      this.group.visible = true;
    }
  }

  /**
   * Hide preview when pointer leaves the valid terrain grid
   */
  public hide(): void {
    if (this.isVisible) {
      this.isVisible = false;
      this.group.visible = false;
      this.currentGridX = -1;
      this.currentGridZ = -1;
    }
  }

  /**
   * Subtle holographic pulsing animation
   */
  public animate(t: number): void {
    if (!this.isVisible) return;
    const pulse = 0.52 + Math.sin(t * 6) * 0.12;
    this.validMaterial.opacity = pulse;
    this.invalidMaterial.opacity = pulse;
  }
}
