import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Controls } from './core/Controls';
import { GridSystem } from './city/GridSystem';
import { BuildingManager } from './city/BuildingManager';
import { BuildingPreview } from './city/BuildingPreview';
import { MathUtils } from './utils/MathUtils';

class SimCityApp {
  public engine: Engine;
  public controls: Controls;
  public gridSystem: GridSystem;
  public buildingManager: BuildingManager;
  public preview: BuildingPreview;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseNDC: THREE.Vector2 = new THREE.Vector2(-999, -999);
  private pointerDownPos: THREE.Vector2 = new THREE.Vector2();
  private isPointerDown: boolean = false;

  // HUD Elements
  private elBuildingCount: HTMLElement | null = null;
  private elDrawCalls: HTMLElement | null = null;
  private elFps: HTMLElement | null = null;
  private elCoords: HTMLElement | null = null;

  // FPS tracking
  private lastFpsUpdate: number = 0;
  private frameCount: number = 0;

  constructor() {
    const container = document.getElementById('app') || document.body;

    // 1. Initialize Core Engine & Controls
    this.engine = new Engine(container);
    this.controls = new Controls(this.engine.camera, this.engine.renderer.domElement);

    // 2. Initialize Grid, Building Manager & Preview
    this.gridSystem = new GridSystem();
    this.buildingManager = new BuildingManager();
    this.preview = new BuildingPreview();

    this.engine.scene.add(this.gridSystem.group);
    this.engine.scene.add(this.buildingManager.group);
    this.engine.scene.add(this.preview.group);

    // 3. Cache HUD elements
    this.elBuildingCount = document.getElementById('stat-buildings');
    this.elDrawCalls = document.getElementById('stat-drawcalls');
    this.elFps = document.getElementById('stat-fps');
    this.elCoords = document.getElementById('stat-coords');

    // 4. Bind Input & UI Events
    this.bindEvents();

    // 5. Build an initial aesthetic sample skyline (4 central landmark towers)
    this.buildInitialSeed();

    // 6. Start Render Loop
    this.animate(0);
  }

  private buildInitialSeed(): void {
    // Spawn 4 starter towers around the center square to showcase instant rendering
    const center = Math.floor(25); // center of 50
    this.buildingManager.addBuilding(center - 1, center - 1, 8.5, 0x0284c7);
    this.buildingManager.addBuilding(center, center - 1, 12.0, 0x38bdf8);
    this.buildingManager.addBuilding(center - 1, center, 6.0, 0x10b981);
    this.buildingManager.addBuilding(center, center, 14.5, 0xf59e0b);
    this.updateHUD();
  }

  private bindEvents(): void {
    const canvas = this.engine.renderer.domElement;

    // Pointer Move
    window.addEventListener('pointermove', (e: PointerEvent) => {
      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // Pointer Down (Record pos to distinguish drag from click)
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button === 0) {
        this.isPointerDown = true;
        this.pointerDownPos.set(e.clientX, e.clientY);
      }
    });

    // Pointer Up (Perform build if not dragged)
    canvas.addEventListener('pointerup', (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;

      // Calculate distance between down & up
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist < 5 && e.button === 0) {
        this.handlePointerClick();
      }
    });

    // Pointer Leave
    window.addEventListener('pointerout', (e: PointerEvent) => {
      if (e.relatedTarget === null) {
        this.preview.hide();
        if (this.elCoords) this.elCoords.textContent = '--';
      }
    });

    // Dock Buttons
    document.getElementById('btn-batch-build')?.addEventListener('click', () => {
      this.buildingManager.addRandomBatch(50);
      this.updateHUD();
    });

    document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
      this.controls.reset();
    });

    document.getElementById('btn-clear-city')?.addEventListener('click', () => {
      this.buildingManager.clear();
      this.preview.hide();
      this.updateHUD();
    });
  }

  private handlePointerClick(): void {
    if (!this.preview.visible) return;
    const { gx, gz } = this.preview.gridPos;
    if (this.buildingManager.isOccupied(gx, gz)) return;

    const success = this.buildingManager.addBuilding(gx, gz);
    if (success) {
      // Refresh preview status to occupied
      this.preview.updateSnap(gx, gz, true);
      this.updateHUD();
    }
  }

  private updateRaycast(): void {
    this.raycaster.setFromCamera(this.mouseNDC, this.engine.camera);
    const intersects = this.raycaster.intersectObject(this.gridSystem.raycastPlane, false);

    if (intersects.length > 0) {
      const hit = intersects[0].point;
      const { gx, gz, valid } = MathUtils.worldToGrid(hit.x, hit.z);

      if (valid) {
        const occupied = this.buildingManager.isOccupied(gx, gz);
        this.preview.updateSnap(gx, gz, occupied);
        if (this.elCoords) {
          this.elCoords.textContent = `[${gx}, ${gz}]${occupied ? ' 🔒 已建' : ' ✅ 可建'}`;
        }
      } else {
        this.preview.hide();
        if (this.elCoords) this.elCoords.textContent = '--';
      }
    } else {
      this.preview.hide();
      if (this.elCoords) this.elCoords.textContent = '--';
    }
  }

  private updateHUD(): void {
    if (this.elBuildingCount) {
      this.elBuildingCount.textContent = `${this.buildingManager.count} 棟`;
    }
  }

  private animate(timestamp: number): void {
    requestAnimationFrame((t) => this.animate(t));

    // 1. Update Camera Controls (damping)
    this.controls.update();

    // 2. Update Raycaster Snap-to-Grid
    this.updateRaycast();
    this.preview.animate(timestamp * 0.001);

    // 3. Render Three.js Scene
    this.engine.render();

    // 4. Update Performance Stats
    const drawCalls = this.engine.getDrawCalls();
    if (this.elDrawCalls) {
      this.elDrawCalls.textContent = `${drawCalls} calls`;
    }
    if (this.elBuildingCount) {
      this.elBuildingCount.textContent = `${this.buildingManager.count} 棟`;
    }

    // 5. Measure FPS every 500ms
    this.frameCount++;
    if (timestamp - this.lastFpsUpdate >= 500) {
      const fps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
      if (this.elFps) {
        this.elFps.textContent = `${fps} FPS`;
      }
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new SimCityApp();
  (window as unknown as { __simcityApp: SimCityApp }).__simcityApp = app;
});
