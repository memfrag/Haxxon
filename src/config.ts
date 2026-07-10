// All tuning lives here. Distances in world units, times in seconds.
export const TILE = 1;
export const LANES = 11;                 // grid columns; lane centers x = -5..+5
export const SEG_ROWS = 24;              // rows per segment
export const SEG_LEN = SEG_ROWS * TILE;  // 24 units
export const SPAWN_AHEAD = 100;          // keep segments spawned this far ahead of ship
export const DESPAWN_BEHIND = 25;        // recycle segments this far behind ship
export const REBASE_AT = 512;            // rebase world when scrolled this far since last rebase

export const CAMERA = {
  OFFSET: { x: 26, y: 26, z: 26 },       // camera position (looks at LOOK_AT)
  LOOK_AT: { x: 0, y: 1.2, z: -7 },      // pushes ship toward lower-left of screen
  VIEW_HEIGHT: 15,                        // ortho frustum height in world units
  NEAR: 0.1, FAR: 300,
};

export const COLORS = {
  BG: 0x0b0e1a, FOG: 0x0b0e1a,
  FLOOR: 0x8a5636, FLOOR_EDGE: 0x4d2f1c,
  STARS: 0xcfd8ff,
  PLAYER_BULLET: 0xffe066, ENEMY_BULLET: 0xff5533,
  SHADOW: 0x000000,
};
export const FOG_NEAR = 70, FOG_FAR = 140;

export const SHIP = {
  SCALE: 0.55,
  LATERAL_SPEED: 5.5, VERTICAL_SPEED: 3.2,
  MIN_Y: 0.3, MAX_Y: 5.2,                 // altitude clamps here; ground is a floor, not a hazard
  CLAMP_X: 5.0,
  HALF: { x: 0.5, y: 0.2, z: 0.55 },      // collision AABB half-extents
  BANK_MAX: 0.45, PITCH_MAX: 0.25, TILT_LERP: 8,
};

export const FUEL = { MAX: 100, DRAIN: 2.5, LOW: 25 };

export const COMBAT = {
  FIRE_COOLDOWN: 0.22,
  PLAYER_BULLET_SPEED: 16,                // scene-space, toward -Z
  PLAYER_POOL: 16,
  ENEMY_BULLET_SPEED: 6.0,                // scene-space, toward ship
  ENEMY_POOL: 32,
  BULLET_TTL: 5,
  HIT_INFLATE: 0.35,                      // inflate colliders for bullet hits (forgiveness)
  TURRET_RANGE_MIN: 4, TURRET_RANGE_MAX: 34,  // turret fires when (turretU - dist) in this range
};

export const GAME = {
  START_LIVES: 4, INVULN: 3.0, DEATH_PAUSE: 1.6,
  FORTRESS_SEGS: 8,                       // per level (includes entry + gate segments)
  SPACE_SEGS: 4,
  ATTRACT_SCROLL: 3,                      // title-screen scroll speed
};

export const POINTS = {
  TURRET_SINGLE: 100, TURRET_DOUBLE: 200,
  BARREL: 25, BARRELS: 50, SILO: 300,
  METEOR: 50, AIRCRAFT: 150,
};
export const REFILL = { BARREL: 12, BARRELS: 20, SILO: 55 };

// --- difficulty helpers (level is 1-based) ---
export const scrollSpeed = (level: number) => Math.min(5.5 + 0.5 * (level - 1), 9);
export const turretCooldown = (level: number) => Math.max(3.4 - 0.15 * (level - 1), 1.6);
export const waveInterval = (level: number) => Math.max(3.4 - 0.2 * (level - 1), 1.8);
export const waveSize = (level: number) => Math.min(1 + (level >> 1), 4);
export const meteorCount = (level: number) => Math.min(3 + level, 8);
export const AIRCRAFT_SPEED = 4.5;        // added to scroll speed, scene-space +Z
