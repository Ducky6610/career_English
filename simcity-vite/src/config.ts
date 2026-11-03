export const CONFIG = {
  // Grid Specification
  CELL_SIZE: 2,
  GRID_SIZE: 50,
  get TOTAL_CELLS(): number {
    return this.GRID_SIZE * this.GRID_SIZE; // 2500 cells
  },
  get WORLD_SIZE(): number {
    return this.CELL_SIZE * this.GRID_SIZE; // 100 units
  },

  // Visual Atmosphere
  FOG_COLOR: 0xd0e0f0,
  FOG_DENSITY: 0.012,
  BACKGROUND_COLOR: 0xd0e0f0,

  // Camera & Controls
  MAX_POLAR_ANGLE: Math.PI / 2 - 0.05, // ~87 degrees to prevent ground clipping
  MIN_DISTANCE: 6,
  MAX_DISTANCE: 140,
  DEFAULT_FOV: 45,

  // Building Dimensions
  MIN_BUILDING_HEIGHT: 2.0,
  MAX_BUILDING_HEIGHT: 15.0,
  BUILDING_GAP_RATIO: 0.90, // Leave 10% gap for roads/walkways

  // SimCity Color Palette
  BUILDING_COLORS: [
    0x0284c7, // Sky Blue (Corporate HQ)
    0x0ea5e9, // Light Blue (Financial Tower)
    0x38bdf8, // Cyan Blue (Tech Center)
    0x0d9488, // Dark Teal (Medical Center)
    0x14b8a6, // Teal (Eco Lab)
    0x10b981, // Emerald Green (Sustainable Complex)
    0x059669, // Forest Green (Residential Plaza)
    0xf59e0b, // Amber (Commercial Mall)
    0xf97316, // Orange (Trade Union)
    0x8b5cf6, // Violet (Cultural Arts Tower)
    0x6366f1, // Indigo (Telecom Skyscraper)
    0x64748b, // Silver Slate (Government Center)
    0x475569, // Steel (Modern Condos)
    0x334155  // Deep Slate (High-density Tower)
  ]
};
