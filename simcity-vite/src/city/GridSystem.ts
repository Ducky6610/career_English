import * as THREE from 'three';
import { CONFIG } from '../config';

export class GridSystem {
  public group: THREE.Group;
  public raycastPlane: THREE.Mesh;
  public gridHelper: THREE.GridHelper;
  public groundMesh: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();

    // 1. Visible Ground Mesh with Shadow Reception & Subdued Slate Tone
    const groundGeo = new THREE.PlaneGeometry(CONFIG.WORLD_SIZE + 20, CONFIG.WORLD_SIZE + 20);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Deep dark slate terrain for clean SimCity contrast
      roughness: 0.85,
      metalness: 0.1
    });

    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.01;
    this.groundMesh.receiveShadow = true;
    this.group.add(this.groundMesh);

    // 2. City Grid Lines: 50 cells across 100 units
    this.gridHelper = new THREE.GridHelper(
      CONFIG.WORLD_SIZE,
      CONFIG.GRID_SIZE,
      0x38bdf8, // Center axes color: Cyan
      0x334155  // Grid division color: Slate blue
    );
    this.gridHelper.position.y = 0.01;
    this.group.add(this.gridHelper);

    // 3. Transparent Raycast Target for fast intersection
    const raycastGeo = new THREE.PlaneGeometry(CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE);
    const raycastMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.raycastPlane = new THREE.Mesh(raycastGeo, raycastMat);
    this.raycastPlane.rotation.x = -Math.PI / 2;
    this.group.add(this.raycastPlane);
  }
}
