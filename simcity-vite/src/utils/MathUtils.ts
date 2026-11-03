import { CONFIG } from '../config';

export class MathUtils {
  private static readonly HALF_WORLD = CONFIG.WORLD_SIZE / 2;

  /**
   * Convert world coordinates (x, z) to integer grid indices (gx, gz) in range [0, GRID_SIZE - 1]
   */
  static worldToGrid(x: number, z: number): { gx: number; gz: number; valid: boolean } {
    const gx = Math.floor((x + this.HALF_WORLD) / CONFIG.CELL_SIZE);
    const gz = Math.floor((z + this.HALF_WORLD) / CONFIG.CELL_SIZE);

    const valid = gx >= 0 && gx < CONFIG.GRID_SIZE && gz >= 0 && gz < CONFIG.GRID_SIZE;
    return { gx, gz, valid };
  }

  /**
   * Convert integer grid indices (gx, gz) to the center world coordinates (worldX, worldZ)
   */
  static gridToWorld(gx: number, gz: number): { worldX: number; worldZ: number } {
    const worldX = -this.HALF_WORLD + gx * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
    const worldZ = -this.HALF_WORLD + gz * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
    return { worldX, worldZ };
  }

  /**
   * Generates a unique key for grid occupancy check
   */
  static gridKey(gx: number, gz: number): string {
    return `${gx}_${gz}`;
  }

  /**
   * Random building height between MIN_BUILDING_HEIGHT and MAX_BUILDING_HEIGHT
   */
  static getRandomHeight(): number {
    const range = CONFIG.MAX_BUILDING_HEIGHT - CONFIG.MIN_BUILDING_HEIGHT;
    // Bias slightly towards mid-to-high skyscrapers for a dynamic SimCity skyline
    const r = Math.pow(Math.random(), 0.85);
    return Number((CONFIG.MIN_BUILDING_HEIGHT + r * range).toFixed(2));
  }

  /**
   * Select a random color from SimCity palette
   */
  static getRandomColor(): number {
    const colors = CONFIG.BUILDING_COLORS;
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
