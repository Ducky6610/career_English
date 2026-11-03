import * as THREE from 'three';
import { CONFIG } from '../config';
import { MathUtils } from '../utils/MathUtils';

export interface BuildingData {
  gx: number;
  gz: number;
  height: number;
  colorHex: number;
  instanceIndex: number;
}

export class BuildingManager {
  public group: THREE.Group;
  public instancedMesh: THREE.InstancedMesh;
  public occupied: Map<string, BuildingData>;
  private maxCapacity: number;
  private currentCount: number = 0;

  // Temp calculation objects to avoid GC overhead
  private dummyMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private dummyPos: THREE.Vector3 = new THREE.Vector3();
  private dummyQuat: THREE.Quaternion = new THREE.Quaternion();
  private dummyScale: THREE.Vector3 = new THREE.Vector3();
  private dummyColor: THREE.Color = new THREE.Color();

  constructor() {
    this.group = new THREE.Group();
    this.maxCapacity = CONFIG.TOTAL_CELLS; // 2500 max buildings
    this.occupied = new Map();

    // 1. Shared Base Geometry: 1x1x1 Unit Box
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // 2. High-Fidelity PBR Standard Material
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.38,
      metalness: 0.22,
      envMapIntensity: 1.0
    });

    // 3. Create InstancedMesh (Single Draw Call for all buildings)
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxCapacity);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0; // Starts empty
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;

    // Enable Frustum Culling
    this.instancedMesh.frustumCulled = true;

    // Initialize per-instance colors buffer
    const colors = new Float32Array(this.maxCapacity * 3);
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);

    this.group.add(this.instancedMesh);
  }

  public get count(): number {
    return this.currentCount;
  }

  public isOccupied(gx: number, gz: number): boolean {
    return this.occupied.has(MathUtils.gridKey(gx, gz));
  }

  /**
   * Append a building instance to the InstancedMesh at (gx, gz)
   */
  public addBuilding(gx: number, gz: number, customHeight?: number, customColor?: number): boolean {
    if (this.currentCount >= this.maxCapacity) {
      console.warn('City has reached maximum building capacity!');
      return false;
    }

    const key = MathUtils.gridKey(gx, gz);
    if (this.occupied.has(key)) {
      return false; // Cell is already built upon
    }

    const height = customHeight ?? MathUtils.getRandomHeight();
    const colorHex = customColor ?? MathUtils.getRandomColor();
    const { worldX, worldZ } = MathUtils.gridToWorld(gx, gz);

    // Calculate instance transform matrix
    const w = CONFIG.CELL_SIZE * CONFIG.BUILDING_GAP_RATIO;
    const d = CONFIG.CELL_SIZE * CONFIG.BUILDING_GAP_RATIO;

    this.dummyPos.set(worldX, height / 2, worldZ);
    this.dummyQuat.identity();
    this.dummyScale.set(w, height, d);
    this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);

    // Update GPU buffers
    const index = this.currentCount;
    this.instancedMesh.setMatrixAt(index, this.dummyMatrix);

    this.dummyColor.setHex(colorHex);
    this.instancedMesh.setColorAt(index, this.dummyColor);

    // Record occupied data
    this.occupied.set(key, {
      gx,
      gz,
      height,
      colorHex,
      instanceIndex: index
    });

    this.currentCount++;
    this.instancedMesh.count = this.currentCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    // Keep Frustum Culling bounding volume accurate
    this.instancedMesh.computeBoundingSphere();
    return true;
  }

  /**
   * Batch append multiple random buildings for stress testing 60 FPS
   */
  public addRandomBatch(amount: number = 50): number {
    let added = 0;
    const availableCells: { gx: number; gz: number }[] = [];

    for (let gx = 0; gx < CONFIG.GRID_SIZE; gx++) {
      for (let gz = 0; gz < CONFIG.GRID_SIZE; gz++) {
        if (!this.isOccupied(gx, gz)) {
          availableCells.push({ gx, gz });
        }
      }
    }

    // Shuffle and pick
    for (let i = availableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
    }

    const toAdd = Math.min(amount, availableCells.length);
    for (let i = 0; i < toAdd; i++) {
      const cell = availableCells[i];
      if (this.addBuilding(cell.gx, cell.gz)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Clear all buildings in city
   */
  public clear(): void {
    this.currentCount = 0;
    this.occupied.clear();
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
    this.instancedMesh.computeBoundingSphere();
  }
}
