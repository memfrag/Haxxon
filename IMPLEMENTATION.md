# HAXXON — Implementation Guide

A Zaxxon-style isometric 3D scrolling shooter for the browser, built with **Three.js + Vite + TypeScript** and Kenney's CC0 "Space Kit" GLB models (already present in `models/`).

This document is a complete, self-contained build spec. Follow it top to bottom. Where exact code is given, copy it verbatim. Where pseudocode is given, implement it faithfully — all constants, formulas, and sign conventions have been worked out and verified against the actual model files. Do not invent different coordinate conventions.

---

## 0. Current state of the repo (ALREADY DONE — do not redo)

- `npm install` done: `three@^0.185`, dev deps `vite@^8`, `typescript@^7`, `@types/three`.
- `package.json` has `"type": "module"` and scripts: `dev` → `vite`, `build` → `tsc --noEmit && vite build`, `preview` → `vite preview`.
- `public/models` is a **symlink** to `../models` (so GLBs are served at `/models/<name>.glb`).
- Directories `src/core/` and `src/game/` exist.
- `models/` contains 153 GLB files.

Still to create: `.gitignore` (`node_modules/`, `dist/`, `.DS_Store`), `tsconfig.json`, `index.html`, `style.css`, and everything under `src/`.

---

## 1. Game design summary (what you are building)

- Ship flies over an enemy fortress that scrolls diagonally (classic Zaxxon iso view, orthographic camera). The ship stays near a fixed screen position; the world moves past it.
- Player controls **lateral position (X)** and **altitude (Y)**. Altitude is the core skill: fly over walls or thread gaps; dive low to shoot barrels/turrets; crash if you touch the fortress floor.
- **Fuel** drains constantly. Shooting fuel barrels/silos refills it (classic Zaxxon quirk). Empty tank = death.
- **Discrete looping levels**: 8 fortress segments → 4 space segments (no floor; meteors to dodge/shoot + enemy aircraft fly-bys) → level+1, harder, repeat forever.
- Turrets aim and shoot at the player (dumb-fire). Aircraft do NOT shoot in v1 (collision threat only).
- Death → explosion → **respawn in place** with full fuel and 2.5 s blinking invulnerability. 3 lives → game over.
- Controls: `A/D` or `←/→` strafe, `W/S` or `↑/↓` altitude (up = climb; `I` toggles invert), `Space` fire, `P` pause, `M` mute, `R` restart (on game-over screen), `Space` start (on title).
- HUD (DOM overlay): score, persistent high score (localStorage), lives, level, fuel bar, vertical altitude meter. Overlays: loading, title, game over.
- Audio: synthesized WebAudio SFX only (no files): laser, explosion, small hit, refuel blip, low-fuel alarm, aircraft fly-by.

---

## 2. Critical technical conventions (read carefully)

### 2.1 Model facts (measured from the GLB files — trust these)

Every Kenney Space Kit model in this kit is **offset from the origin**: its geometry is centered around roughly `(x=2, y=0, z=1.5)` instead of `(0,0,0)`. Bases sit at `y=0`. The kit's grid unit is **1 world unit**. Therefore every loaded model must be **recentered at load time** (section 5.3): move footprint center to `(0,*,0)` and base to `y=0`.

Measured sizes (width X × height Y × depth Z), after recentering:

| model file | size | notes |
|---|---|---|
| `craft_speederA` | 2.00 × 0.80 × 2.10 | player ship — scale it 0.55 |
| `craft_racer` | 1.20 × 0.75 × 2.03 | enemy aircraft — scale 0.6 |
| `turret_single` | 0.60 × 0.90 × 0.72 | scale 1.2 |
| `turret_double` | 0.90 × 0.70 × 0.60 | scale 1.2 |
| `barrel` | 0.20 × 0.25 × 0.17 | tiny — scale 1.8 |
| `barrels` | 0.55 × 0.35 × 0.50 | scale 1.3 |
| `rocket_fuelB` | 1.00 × 1.00 × 1.00 | fuel silo — scale 1.4 |
| `corridor_windowClosed` | 1.00 × 1.00 × 1.00 | **wall block** — stack these |
| `corridor_roof` | 1.00 × 0.24 × 1.00 | wall cap |
| `gate_complex` | 1.00 × 1.01 × 0.50 | scale 2.2, decor arch |
| `satelliteDish_large` | 0.85 × 0.81 × 0.74 | decor |
| `machine_generatorLarge` | 1.00 × 0.68 × 1.30 | decor |
| `hangar_smallA` | 2.00 × 1.00 × 2.00 | decor, 2×2 footprint |
| `chimney` | 0.40 × 2.00 × 0.40 | decor, tall |
| `pipe_straight` | 0.69 × 0.60 × 1.00 | decor |
| `structure_detailed` | 1.00 × 1.00 × 1.00 | decor scaffold |
| `meteor` / `meteor_detailed` | ~0.87 × 0.73 × 0.8 | space obstacle |
| `meteor_half` | 0.87 × 0.37 × 0.75 | space obstacle |
| `rock_largeA` | 0.92 × 0.50 × 0.83 | space obstacle |
| `craterLarge` | 0.89 × 0.12 × 0.89 | non-solid floor decor |
| `rocks_smallA` | 0.94 × 0.11 × 0.87 | non-solid floor decor |
| `rock` | 0.80 × 0.30 × 0.85 | non-solid floor decor |
| `platform_low` | 1.00 × 0.50 × 1.00 | floor decor tile |
| `terrain_roadStraight` | 1.00 × 0.00 × 1.00 | flat floor decor tile |
| `rocket_baseA` | 1.80 × 1.60 × 1.80 | landmark part |
| `rocket_sidesA` | 1.00 × 1.00 × 1.00 | landmark part |
| `rocket_topA` | 1.00 × 0.80 × 1.00 | landmark part |

**Facing direction is unverified.** Assume ship/aircraft models face `+Z` by default. The manifest gives the ship `yaw: Math.PI` so its nose points `−Z` (direction of travel), and the racer `yaw: 0` (it flies toward the player, `+Z`). At milestone M1/M7, look at the rendered result: if a craft is visibly flying backwards, flip its `yaw` in the manifest by adding/removing `Math.PI`. Same for the turret barrel: the aiming code assumes the barrel points `+Z` at `rotation.y = 0`; if turrets visibly aim away from the ship, add `Math.PI` inside the aim formula.

### 2.2 Coordinate system

- **X** = lateral (positive = screen lower-right). Playfield is 11 lanes, 1 unit each: lane centers at `x = −5 … +5`. Ship clamp: `|x| ≤ 5`.
- **Y** = altitude. `y = 0` is the fortress floor.
- **Z (scene)** = direction of travel is **−Z**. The world scrolls toward **+Z**. The camera sits on the `(+X, +Y, +Z)` diagonal, so −Z appears toward the **upper-right** of the screen and the world slides toward the lower-left — the classic Zaxxon look.
- The ship stays at scene `z = 0` always. It never moves in Z; the world moves.

### 2.3 The "u-axis" (cumulative distance) — the single most important convention

All **game logic** (collision, spawning, turret ranges) happens in a 1-D coordinate called **u** = total distance scrolled since game start. It increases monotonically and never resets mid-run.

- The game keeps a single number `dist` (total scrolled distance). **The ship is always at `u = dist`.**
- Every level element (wall, turret, barrel…) has a **fixed** u-position assigned when its segment is spawned. It never changes.
- Conversion between u and scene Z: `sceneZ = dist − u`. (Things ahead of the ship have `u > dist` → negative sceneZ → upper-right. As `dist` grows, they slide toward `+Z` and pass the ship at `u = dist`.)
- Scene-space objects (bullets, aircraft) convert to u for collision with world objects: `u = dist − sceneZ`.

### 2.4 How the world group + rebasing works (floating-point safety)

All level meshes live in one `THREE.Group` called `world`. Each segment is a child `THREE.Group` of `world`.

- A segment whose start is at cumulative position `P` gets `segment.group.position.z = −(P − rebaseOff)`.
- Each frame: `world.position.z = dist − rebaseOff`.
- Net scene position of the segment = `dist − P`. Correct by construction.
- **Rebase**: when `dist − rebaseOff > 512`, set `rebaseOff = dist`, then update `world.position.z` and every live segment's `group.position.z` with the formulas above. Nothing moves visually; local coordinates stay small forever. (`dist` itself keeps growing as a plain number — that is fine, it's used only in subtractions.)

Meshes inside a segment: a grid cell at `(row r, col c)` of a segment starting at `P` is placed at segment-local `x = c − 5`, `z = −(r + 0.5)` (row r covers u ∈ `[P + r, P + r + 1]`, and higher rows are further ahead = more negative local z).

### 2.5 Fixed timestep

`requestAnimationFrame` render loop with an accumulator running `update(dt)` at a fixed `dt = 1/120` s, accumulator clamped to 0.25 s max (tab-back protection). Exact code in section 6 (`core/loop.ts`).

---

## 3. File tree to create

```
index.html            canvas mount + full HUD DOM (exact markup below)
style.css             HUD/overlay styling (exact css below)
tsconfig.json         (exact content below)
.gitignore
src/
├─ main.ts            bootstrap renderer/scene/camera/lights/stars, load assets, start Game + loop
├─ config.ts          ALL tuning constants (exact content below)
├─ types.ts           shared interfaces (exact content below)
├─ core/
│  ├─ loop.ts         fixed-timestep rAF loop
│  ├─ input.ts        keyboard state + one-shot key consumption + invert flag
│  └─ assets.ts       manifest, GLTF preload, recentering, clone()
└─ game/
   ├─ game.ts         state machine hub; owns score/lives/fuel; coordinates everything
   ├─ world.ts        world group, segment spawn/recycle, rebase, segmentAt(u)
   ├─ director.ts     level flow: which segment def comes next; level number; difficulty helpers
   ├─ segments.ts     the authored fortress grids (exact data below)
   ├─ builder.ts      grid → cloned meshes + colliders + turret entities; space segment generator
   ├─ player.ts       ship movement/clamps/banking, shadow blob + altitude line
   ├─ turrets.ts      per-frame turret aim/cooldown/fire logic
   ├─ aircraft.ts     scene-space fly-by enemies (space sections)
   ├─ bullets.ts      pooled player + enemy projectiles
   ├─ collision.ts    AABB helpers (exact code below)
   ├─ fx.ts           particle explosions + flash
   ├─ audio.ts        synthesized WebAudio SFX + mute
   └─ hud.ts          DOM lookups, HUD updates, overlay show/hide, flash messages
```

No `vite.config.ts` is needed — Vite defaults are correct (root `index.html`, `public/` dir).

---

## 4. Exact contents for the data/markup files

### 4.1 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### 4.2 `index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HAXXON</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div id="app"></div>
  <div id="hud" class="hidden">
    <div id="score-panel">
      <div>SCORE <span id="score">000000</span></div>
      <div class="dim">HI <span id="hiscore">000000</span></div>
    </div>
    <div id="level-panel">LEVEL <span id="level">1</span></div>
    <div id="lives-panel"></div>
    <div id="alt-meter"><div id="alt-fill"></div></div>
    <div id="fuel-panel">
      <span class="label">FUEL</span>
      <div id="fuel-bar"><div id="fuel-fill"></div></div>
    </div>
    <div id="flash-msg"></div>
  </div>
  <div id="overlay-loading" class="overlay">
    <h1>HAXXON</h1>
    <div class="loading-bar"><div id="loading-fill"></div></div>
  </div>
  <div id="overlay-title" class="overlay hidden">
    <h1>HAXXON</h1>
    <p class="tagline">INFILTRATE THE FORTRESS</p>
    <p class="hi">HIGH SCORE <span id="title-hiscore">000000</span></p>
    <div class="controls">
      <p>MOVE &nbsp;<b>&larr;&rarr;</b> / <b>A D</b></p>
      <p>ALTITUDE &nbsp;<b>&uarr;&darr;</b> / <b>W S</b> &nbsp;(<b>I</b> invert)</p>
      <p>FIRE &nbsp;<b>SPACE</b> &nbsp;&middot;&nbsp; <b>P</b> pause &nbsp;&middot;&nbsp; <b>M</b> mute</p>
    </div>
    <p class="blink">PRESS SPACE TO START</p>
  </div>
  <div id="overlay-gameover" class="overlay hidden">
    <h1>GAME OVER</h1>
    <p class="score-line">SCORE <span id="go-score">000000</span></p>
    <p class="hi" id="go-hi-line">HIGH SCORE <span id="go-hiscore">000000</span></p>
    <p class="blink">PRESS R TO RESTART</p>
  </div>
  <div id="overlay-paused" class="overlay hidden"><h2>PAUSED</h2></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### 4.3 `style.css`

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; background: #0b0e1a; }
body { font-family: "Courier New", ui-monospace, monospace; color: #eef2ff; }
#app, #app canvas { position: fixed; inset: 0; display: block; }
.hidden { display: none !important; }

#hud { position: fixed; inset: 0; pointer-events: none; z-index: 10;
  text-shadow: 0 0 6px rgba(0,0,0,.9); font-size: 18px; letter-spacing: 2px; }
#score-panel { position: absolute; top: 16px; left: 20px; }
#score-panel .dim { color: #8b93b8; font-size: 14px; margin-top: 4px; }
#level-panel { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); color: #f5a03c; }
#lives-panel { position: absolute; top: 16px; right: 20px; color: #f5a03c; font-size: 20px; letter-spacing: 6px; }
#alt-meter { position: absolute; left: 20px; top: 50%; transform: translateY(-50%);
  width: 10px; height: 40vh; border: 2px solid #3a4160; background: rgba(10,14,30,.6); }
#alt-fill { position: absolute; bottom: 0; width: 100%; background: #6fd3ff; height: 0%; }
#fuel-panel { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px; }
#fuel-panel .label { color: #f5a03c; }
#fuel-bar { width: 320px; height: 16px; border: 2px solid #3a4160; background: rgba(10,14,30,.6); }
#fuel-fill { height: 100%; width: 100%; background: #f5a03c; transition: background .2s; }
#fuel-fill.low { background: #ff4b3a; }
#flash-msg { position: absolute; top: 22%; left: 50%; transform: translateX(-50%);
  color: #f5a03c; font-size: 22px; opacity: 0; transition: opacity .25s; }

.overlay { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px;
  background: rgba(5, 8, 18, 0.78); letter-spacing: 3px; text-align: center; }
.overlay h1 { font-size: 64px; color: #f5a03c; letter-spacing: 12px;
  text-shadow: 4px 4px 0 #7a4310, 0 0 30px rgba(245,160,60,.35); }
.overlay .tagline { color: #8b93b8; }
.overlay .hi { color: #6fd3ff; }
.overlay .controls { color: #aab2d5; font-size: 14px; line-height: 2; }
.overlay .controls b { color: #eef2ff; }
.overlay .score-line { font-size: 24px; }
.blink { animation: blink 1.1s step-end infinite; color: #eef2ff; }
@keyframes blink { 50% { opacity: 0; } }
.loading-bar { width: 300px; height: 12px; border: 2px solid #3a4160; }
#loading-fill { height: 100%; width: 0%; background: #6fd3ff; }
```

### 4.4 `src/config.ts` (exact — copy verbatim)

```ts
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
  FLOOR: 0x2a2e3f, FLOOR_EDGE: 0x1c1f2e,
  STARS: 0xcfd8ff,
  PLAYER_BULLET: 0xffe066, ENEMY_BULLET: 0xff5533,
  SHADOW: 0x000000,
};
export const FOG_NEAR = 70, FOG_FAR = 140;

export const SHIP = {
  SCALE: 0.55,
  LATERAL_SPEED: 5.5, VERTICAL_SPEED: 3.2,
  MIN_Y: 0.3, MAX_Y: 5.2,
  CRASH_Y: 0.45,                          // below this over fortress floor = crash
  CLAMP_X: 5.0,
  HALF: { x: 0.5, y: 0.2, z: 0.55 },      // collision AABB half-extents
  BANK_MAX: 0.45, PITCH_MAX: 0.25, TILT_LERP: 8,
};

export const FUEL = { MAX: 100, DRAIN: 3.5, LOW: 25 };

export const COMBAT = {
  FIRE_COOLDOWN: 0.22,
  PLAYER_BULLET_SPEED: 16,                // scene-space, toward -Z
  PLAYER_POOL: 16,
  ENEMY_BULLET_SPEED: 7.5,                // scene-space, toward ship
  ENEMY_POOL: 32,
  BULLET_TTL: 5,
  HIT_INFLATE: 0.35,                      // inflate colliders for bullet hits (forgiveness)
  TURRET_RANGE_MIN: 4, TURRET_RANGE_MAX: 42,  // turret fires when (turretU - dist) in this range
};

export const GAME = {
  START_LIVES: 3, INVULN: 2.5, DEATH_PAUSE: 1.6,
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
export const scrollSpeed = (level: number) => Math.min(6.5 + 0.7 * (level - 1), 11);
export const turretCooldown = (level: number) => Math.max(2.4 - 0.2 * (level - 1), 1.2);
export const waveInterval = (level: number) => Math.max(3.0 - 0.25 * (level - 1), 1.5);
export const waveSize = (level: number) => Math.min(1 + (level >> 1), 4);
export const meteorCount = (level: number) => Math.min(4 + level, 10);
export const AIRCRAFT_SPEED = 4.5;        // added to scroll speed, scene-space +Z
```

### 4.5 `src/types.ts` (exact)

```ts
import type * as THREE from 'three';

export type ColliderKind = 'wall' | 'decor' | 'turret' | 'fuel' | 'meteor';

export interface Collider {
  kind: ColliderKind;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minU: number; maxU: number;   // cumulative distance space (see section 2.3)
  hp: number;                   // 0 = indestructible (walls, decor)
  points: number;
  fuel: number;                 // fuel refill granted when destroyed
  alive: boolean;
  mesh?: THREE.Object3D;        // removed from segment group on destroy
}

export interface TurretEntity {
  collider: Collider;
  mesh: THREE.Object3D;         // rotated to aim
  double: boolean;
  cooldown: number;             // seconds until it may fire again
}

export type SegmentKind = 'fortress' | 'space';

export interface Segment {
  kind: SegmentKind;
  start: number;                // u position of the segment's near edge
  len: number;
  group: THREE.Group;
  colliders: Collider[];
  turrets: TurretEntity[];
  spinners: { mesh: THREE.Object3D; ax: number; ay: number; speed: number }[]; // meteors
}

export interface SegmentDef {
  rows: string[];               // SEG_ROWS strings of LANES chars; row 0 = reached first
  diff: number;                 // 0..3
  gate?: number;                // row index that gets the gate arch mesh
}
```

---

## 5. Core modules (`src/core/`)

### 5.1 `core/loop.ts` (exact)

```ts
const STEP = 1 / 120;
const MAX_ACC = 0.25;

export function startLoop(update: (dt: number) => void, render: () => void): void {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    acc = Math.min(acc + (now - last) / 1000, MAX_ACC);
    last = now;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
```

### 5.2 `core/input.ts`

State: `held: Set<string>` (event.code), `oneShot: Set<string>`, exported mutable flag object `settings = { invertY: false }` (initialize `invertY` from `localStorage.getItem('haxxon.invert') === '1'`).

- `window.addEventListener('keydown', e)`: if `e.repeat` return. Add `e.code` to both sets. Call `e.preventDefault()` when code is one of Arrow keys / Space (stops page scrolling).
- `keyup`: remove from `held`.
- `isDown(...codes: string[]): boolean` — true if any code in `held`.
- `consume(code: string): boolean` — if in `oneShot`, delete it and return true; else false. (One-shot semantics survive multiple fixed-timestep substeps per frame.)
- Helpers used by game:
  - `moveX(): number` → `(isDown('ArrowRight','KeyD') ? 1 : 0) - (isDown('ArrowLeft','KeyA') ? 1 : 0)`
  - `moveY(): number` → `(isDown('ArrowUp','KeyW') ? 1 : 0) - (isDown('ArrowDown','KeyS') ? 1 : 0)`, multiplied by `-1` if `settings.invertY`.
  - `fireHeld(): boolean` → `isDown('Space')`.
- `toggleInvert()`: flips flag, persists to localStorage, returns new value.

### 5.3 `core/assets.ts`

Manifest (exact — logical name → file + optional yaw/scale):

```ts
export const MANIFEST = {
  ship:        { file: 'craft_speederA', yaw: Math.PI, scale: 0.55 },
  racer:       { file: 'craft_racer',    yaw: 0,       scale: 0.6 },
  turret:      { file: 'turret_single',  scale: 1.2 },
  turretDouble:{ file: 'turret_double',  scale: 1.2 },
  barrel:      { file: 'barrel',         scale: 1.8 },
  barrels:     { file: 'barrels',        scale: 1.3 },
  silo:        { file: 'rocket_fuelB',   scale: 1.4 },
  wall:        { file: 'corridor_windowClosed' },
  wallRoof:    { file: 'corridor_roof' },
  gate:        { file: 'gate_complex',   scale: 2.2 },
  dish:        { file: 'satelliteDish_large' },
  generator:   { file: 'machine_generatorLarge' },
  hangar:      { file: 'hangar_smallA' },
  chimney:     { file: 'chimney' },
  pipe:        { file: 'pipe_straight' },
  structure:   { file: 'structure_detailed' },
  crater:      { file: 'craterLarge' },
  rocksSmall:  { file: 'rocks_smallA' },
  rock:        { file: 'rock' },
  meteor:      { file: 'meteor' },
  meteorB:     { file: 'meteor_detailed' },
  meteorHalf:  { file: 'meteor_half' },
  rockLarge:   { file: 'rock_largeA' },
  platformLow: { file: 'platform_low' },
  road:        { file: 'terrain_roadStraight' },
  rocketBase:  { file: 'rocket_baseA' },
  rocketSides: { file: 'rocket_sidesA' },
  rocketTop:   { file: 'rocket_topA' },
} as const;
export type ModelName = keyof typeof MANIFEST;
```

`loadAll(onProgress: (frac: number) => void): Promise<void>`:
- One `GLTFLoader`. `Promise.all` over manifest entries, each `loader.loadAsync('/models/' + def.file + '.glb')`. Count completions; call `onProgress(done/total)` after each.
- For each loaded gltf, build a **prepared prototype** (recenter + yaw + scale) and store in a `Map<ModelName, THREE.Group>`:

```ts
function prepare(scene: THREE.Object3D, def: { yaw?: number; scale?: number }): THREE.Group {
  const box = new THREE.Box3().setFromObject(scene);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  scene.position.set(-cx, -box.min.y, -cz);   // footprint center -> origin, base -> y=0
  const inner = new THREE.Group();
  inner.add(scene);
  if (def.yaw) inner.rotation.y = def.yaw;
  inner.scale.setScalar(def.scale ?? 1);
  const wrapper = new THREE.Group();
  wrapper.add(inner);
  return wrapper;
}
```

- `clone(name: ModelName): THREE.Group` → `protos.get(name)!.clone(true)`. (Plain `.clone(true)` shares geometries/materials — cheap. Kit has no skinned meshes.)
- **Never call `.dispose()`** on anything from these protos.

---

## 6. Game modules (`src/game/`)

### 6.1 `collision.ts` (exact)

```ts
import type { Collider } from '../types';
import type { Segment } from '../types';

export function boxOverlap(
  aMinX: number, aMaxX: number, aMinY: number, aMaxY: number, aMinU: number, aMaxU: number,
  c: Collider,
): boolean {
  return aMinX < c.maxX && aMaxX > c.minX
      && aMinY < c.maxY && aMaxY > c.minY
      && aMinU < c.maxU && aMaxU > c.minU;
}

export function pointHits(x: number, y: number, u: number, c: Collider, inflate: number): boolean {
  return x > c.minX - inflate && x < c.maxX + inflate
      && y > c.minY - inflate && y < c.maxY + inflate
      && u > c.minU - inflate && u < c.maxU + inflate;
}

/** Iterate alive colliders of segments overlapping u-range [u0, u1]. */
export function* collidersNear(segments: Segment[], u0: number, u1: number): Generator<Collider> {
  for (const seg of segments) {
    if (seg.start > u1 || seg.start + seg.len < u0) continue;
    for (const c of seg.colliders) if (c.alive) yield c;
  }
}
```

### 6.2 `segments.ts` — authored level data (exact)

Grid legend (one char per lane, 11 chars per row, 24 rows per segment; **row 0 is reached first**):

| char | meaning | collider |
|---|---|---|
| `.` | empty | — |
| `1`–`4` | wall, N stacked blocks (height N×1.0 + roof cap) | indestructible, full cell, height N |
| `t` | turret_single | destructible hp 1, 100 pts, half 0.32, h 1.1 |
| `T` | turret_double | destructible hp 2, 200 pts, half 0.4, h 0.9 |
| `b` | barrel (fuel +12) | destructible hp 1, 25 pts, half 0.18, h 0.45 |
| `B` | barrels (fuel +20) | destructible hp 1, 50 pts, half 0.36, h 0.46 |
| `F` | fuel silo rocket_fuelB (fuel +55) | destructible hp 1, 300 pts, half 0.7, h 1.4 |
| `d` | satellite dish | solid decor h 0.85, half 0.42 |
| `m` | generator | solid decor h 0.7, half 0.5 |
| `h` | hangar (2×2!) | solid decor h 1.0, half 1.0 — leave the 8 neighbor cells empty |
| `c` | chimney | solid decor h 2.0, half 0.2 |
| `p` | pipe | solid decor h 0.6, half 0.35 |
| `s` | structure | solid decor h 1.0, half 0.5 |
| `R` | rocket landmark (2×2!) base+sides+top stacked | solid decor h 3.4, half 0.9 — leave neighbors empty |
| `x` | crater | none (visual only) |
| `k` | small rocks | none |
| `o` | rock | none |

Wall gaps that players must thread are always ≥ 2 cells wide (ship is 1.1 wide).

Export `START_DEF`, `GATE_DEF`, and `FORTRESS_POOL: SegmentDef[]` with exactly this data:

```ts
export const START_DEF: SegmentDef = { diff: 0, rows: [
  "...........",
  "...........",
  "k.........x",
  "...........",
  "....b.b....",
  "...........",
  "d.........m",
  "...........",
  "...B...B...",
  "...........",
  "x.........k",
  "...........",
  "....t......",
  "...........",
  "...........",
  "11111..1111",
  "...........",
  "......b....",
  "...........",
  "c.........c",
  "...........",
  "....F......",
  "...........",
  "...........",
]};

const EASY_A: SegmentDef = { diff: 1, rows: [
  "...........",
  "..b...b....",
  "...........",
  "t.........t",
  "...........",
  "....222....",
  "...........",
  "..F........",
  "...........",
  ".........B.",
  "...........",
  "..t........",
  "...........",
  "2222...2222",
  "...........",
  "....b.b....",
  "...........",
  "m.........d",
  "......t....",
  "...........",
  "..B........",
  "...........",
  "..........x",
  "k..........",
]};

const EASY_B: SegmentDef = { diff: 1, rows: [
  "...........",
  "....F.F....",
  "...........",
  "...........",
  "11111111111",
  "...........",
  "..b.....b..",
  "...........",
  "t....s....t",
  "...........",
  "...........",
  "..2222222..",
  "...........",
  "....B......",
  "...........",
  "d..........",
  "..........t",
  "...........",
  "..F........",
  "...........",
  "x......k...",
  "...........",
  "...........",
  "...........",
]};

const MED_A: SegmentDef = { diff: 2, rows: [
  "...........",
  "..t...T....",
  "...........",
  "22222......",
  "...........",
  "......22222",
  "...........",
  "....F......",
  "...........",
  "T..........",
  "...........",
  "33333..3333",
  "...........",
  "..B...B....",
  "...........",
  "......t....",
  "c.........c",
  "...........",
  "...........",
  ".p.p.p.p.p.",
  "...........",
  "....b......",
  "...........",
  "...........",
]};

const MED_B: SegmentDef = { diff: 2, rows: [
  "...........",
  ".h.........",
  "...........",
  "......b....",
  "...........",
  "....t......",
  "...........",
  "2222.....22",
  "...........",
  ".........R.",
  "...........",
  "..F........",
  "...........",
  "....T......",
  "...........",
  "222..222..2",
  "...........",
  "......B....",
  "...........",
  "t.........t",
  "...........",
  "..b........",
  "...........",
  "...........",
]};

const MED_C: SegmentDef = { diff: 2, rows: [
  "...........",
  "s.........s",
  "...........",
  "s...F.....s",
  "...........",
  "s.........s",
  "....t......",
  "s.........s",
  "...........",
  "..333333333",
  "...........",
  "b.........b",
  "...........",
  "333333333..",
  "...........",
  "....T......",
  "...........",
  "..B.....B..",
  "...........",
  "m....c....d",
  "...........",
  "...........",
  "....b......",
  "...........",
]};

const HARD_A: SegmentDef = { diff: 3, rows: [
  "...........",
  "..T.....T..",
  "...........",
  "3333..33333",
  "...........",
  "......t....",
  "...........",
  "33333333..3",
  "...........",
  "..F...F....",
  "...........",
  "T.........T",
  "...........",
  "3..33333333",
  "...........",
  "....B......",
  "...........",
  "..t...t....",
  "...........",
  "44444444444",
  "...........",
  "......F....",
  "...........",
  "...........",
]};

const HARD_B: SegmentDef = { diff: 3, rows: [
  "...........",
  "...........",
  ".t.T...T.t.",
  "...........",
  "22..22..22.",
  "...........",
  "....F......",
  "...........",
  ".T.......T.",
  "...........",
  "..33333333.",
  "...........",
  "......b....",
  "...........",
  "t....T....t",
  "...........",
  "33333..3333",
  "...........",
  "..B...B....",
  "...........",
  "....t......",
  "...........",
  "..F........",
  "...........",
]};

export const GATE_DEF: SegmentDef = { diff: 0, gate: 8, rows: [
  "...........",
  "....F.F....",
  "...........",
  "...........",
  "t.........t",
  "...........",
  "...........",
  "...........",
  "33333..3333",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
  "...........",
]};

export const FORTRESS_POOL: SegmentDef[] = [EASY_A, EASY_B, MED_A, MED_B, MED_C, HARD_A, HARD_B];
```

**NOTE:** every `rows` array above MUST have exactly 24 strings of exactly 11 chars. Some arrays above list 23 or 24 — while implementing, pad any short array with `"..........."` rows at the END so all have 24, and add a startup assertion:
```ts
for (const def of [START_DEF, GATE_DEF, ...FORTRESS_POOL]) {
  while (def.rows.length < SEG_ROWS) def.rows.push('.'.repeat(LANES));
  for (const r of def.rows) if (r.length !== LANES) throw new Error('bad segment row: ' + r);
}
```

### 6.3 `builder.ts`

Two exported functions. Both take a `start: number` (u position) and return a `Segment` (types §4.5). The caller (world.ts) adds `segment.group` to the world group and positions it.

**`buildFortress(def: SegmentDef, start: number): Segment`**

1. Create `group = new THREE.Group()`.
2. **Floor**: one `PlaneGeometry(LANES + 2, SEG_LEN)` (width 13), `MeshLambertMaterial({ color: COLORS.FLOOR })`, `rotation.x = -Math.PI/2`, position `(0, -0.02, -SEG_LEN/2)` (plane center; remember rows extend toward local −z). Add two thin edge strips: `BoxGeometry(0.6, 0.5, SEG_LEN)` color `FLOOR_EDGE` at `x = ±(LANES/2 + 0.8)`, `y = -0.3`, `z = -SEG_LEN/2` (fortress rim).
3. **Cells**: for each row `r` (0..23), col `c` (0..10), char `ch = def.rows[r][c]`; skip `'.'`. Cell center: local `x = c - 5`, `z = -(r + 0.5)`; u-range `[start + r, start + r + 1]`, x-range `[x - 0.5, x + 0.5]`.
   - **Digit `1`–`4`** (wall): let `n = +ch`. Stack `n` clones of `wall` at `y = 0, 1, …` plus one `wallRoof` clone at `y = n`. Do NOT create one collider per cell — merge per row: after scanning the row, group **contiguous runs of the same digit** into single colliders `{ kind:'wall', minX: runStartX-0.5, maxX: runEndX+0.5, minY: 0, maxY: n, minU: start+r, maxU: start+r+1, hp: 0, points: 0, fuel: 0, alive: true }` (no mesh reference needed).
   - **`t` / `T`**: clone `turret`/`turretDouble`, place at cell, push collider `{kind:'turret', hp: 1 or 2, points: POINTS.TURRET_*, halfX/Z from legend table, minY:0, maxY: 1.1 or 0.9, mesh}` AND push `TurretEntity { collider, mesh, double, cooldown: random 0..1.5 }` to `segment.turrets`.
   - **`b`/`B`/`F`**: clone `barrel`/`barrels`/`silo`; collider kind `'fuel'`, hp 1, points/fuel/half/height from the legend table, `mesh` set.
   - **Decor letters** (`d m h c p s`): clone the model; collider kind `'decor'`, `hp: 0`, half/height from legend.
   - **`R`**: build a group: `rocketBase` at y 0, `rocketSides` at y 1.6, `rocketTop` at y 2.6. One collider h 3.4, half 0.9, kind `'decor'`.
   - **`x`/`k`/`o`**: clone `crater`/`rocksSmall`/`rock`; NO collider.
   - Set every prop clone's position to the cell center. Give fuel/decor props a random `rotation.y` of `0/90/180/270°` for variety (rotate the wrapper group, colliders stay axis-aligned — fine, footprints are near-square).
4. **Gate** (`def.gate !== undefined`): clone `gate` and place at `x = 0.5` (the gap center of the authored gate row), `z = -(def.gate + 0.5)`. Visual only, no collider.
5. **Floor detail**: ~6 random cells per segment that are `'.'`: clone `road` (flat) or `platformLow` — place only `road` (zero height, no collider needed); if `platformLow` is used give it a `'decor'` collider (h 0.5). Simplest: 6 `road` tiles, no colliders.
6. Return `{ kind: 'fortress', start, len: SEG_LEN, group, colliders, turrets, spinners: [] }`.

**`buildSpace(start: number, level: number): Segment`**

1. Group; **no floor** (the global starfield shows below).
2. `n = meteorCount(level)` meteors. Pick `n` distinct rows from 2..21 (shuffle). For each: random col 0..10 (`x = col - 5`), random `y` in `0.6..4.6`, random model of `meteor|meteorB|meteorHalf|rockLarge`, random scale `s` in `1.0..2.2` (apply `mesh.scale.multiplyScalar(s)` on the clone), position at `(x, y - 0.36*s, z=-(row+0.5))` so the (recentered, base-at-0) mesh is vertically centered on `y`.
   - Collider: `{ kind:'meteor', minX: x-0.45*s, maxX: x+0.45*s, minY: y-0.4*s, maxY: y+0.4*s, minU: start+row+0.5-0.45*s, maxU: start+row+0.5+0.45*s, hp: s > 1.6 ? 2 : 1, points: POINTS.METEOR, fuel: 0, alive: true, mesh }`.
   - Spinner: `{ mesh, ax: rand(-1,1), ay: rand(-1,1), speed: rand(0.3, 1.2) }`.
3. Return `{ kind: 'space', start, len: SEG_LEN, group, colliders, turrets: [], spinners }`.

### 6.4 `director.ts`

Owns level flow. State: `level = 1`, `seqIndex = 0` (position within the level's segment sequence).

Per level the sequence is: `START-like entry` (use `START_DEF` for level 1, `EASY_A` for later levels' first segment), then `GAME.FORTRESS_SEGS - 2 = 6` picks from `FORTRESS_POOL`, then `GATE_DEF`, then `GAME.SPACE_SEGS = 4` space segments. After the last space segment: `level += 1`, `seqIndex = 0`.

- `next(): { kind: 'fortress'; def: SegmentDef } | { kind: 'space' }` — returns the next segment descriptor and advances `seqIndex` (and possibly `level`).
- Weighted pool pick: `target = Math.min(3, level)`; `weight(def) = Math.max(0.25, 1.5 - Math.abs(def.diff - target))`; standard roulette-wheel selection over `FORTRESS_POOL`.
- `reset()`: level 1, seqIndex 0.
- Expose `level` (getter).

### 6.5 `world.ts`

Owns: `group: THREE.Group` (added to scene by game), `segments: Segment[]`, `rebaseOff = 0`, `nextStart = 0`, a reference to the director and builder.

- `ensure(dist: number)`: 
  - While `nextStart < dist + SPAWN_AHEAD`: ask `director.next()`; call the matching builder with `start = nextStart`; set `seg.group.position.z = -(seg.start - rebaseOff)`; add group to world group; push to `segments`; `nextStart += seg.len`.
  - Recycle: while `segments[0]` exists and `segments[0].start + segments[0].len < dist - DESPAWN_BEHIND`: remove its group from the world group (`this.group.remove(seg.group)`), shift it off the array. (No dispose — assets are shared.)
  - Rebase: if `dist - rebaseOff > REBASE_AT`: `rebaseOff = dist`; for each segment re-set `group.position.z = -(seg.start - rebaseOff)`.
  - Finally every frame: `this.group.position.z = dist - rebaseOff`.
- `segmentAt(u: number): Segment | undefined` — linear scan (few segments live).
- `uToScene(u: number, dist: number): number` → `dist - u` (helper for turret/fx positions).
- `updateSpinners(dt)`: for each live segment's spinners: `mesh.rotation.x += ax*speed*dt; mesh.rotation.y += ay*speed*dt`.
- `clear()`: remove all segment groups, `segments = []`, `nextStart = 0`, `rebaseOff = 0`, `group.position.z = 0`.
- `destroyCollider(c: Collider, seg-lookup not needed)`: `c.alive = false`; if `c.mesh` remove from its parent.
  (Convenience: game calls this when a bullet kills something.)

### 6.6 `player.ts`

Owns ship visuals + kinematics. Constructed with the `ship` clone from assets, added to the scene (NOT the world group) at `(0, 1.5, 0)`.

- State: `x`, `y`, mutable; `roll`, `pitch` (visual lerp state).
- `update(dt, inputX, inputY)`:
  - `x = clamp(x + inputX * SHIP.LATERAL_SPEED * dt, -SHIP.CLAMP_X, SHIP.CLAMP_X)`
  - `y = clamp(y + inputY * SHIP.VERTICAL_SPEED * dt, SHIP.MIN_Y, SHIP.MAX_Y)`
  - `roll += (targetRoll - roll) * min(1, SHIP.TILT_LERP * dt)` with `targetRoll = -inputX * SHIP.BANK_MAX`; same pattern for `pitch` with `targetPitch = inputY * SHIP.PITCH_MAX`.
  - Apply: `mesh.position.set(x, y, 0)`, `mesh.rotation.z = roll`, `mesh.rotation.x = pitch`.
- **Shadow blob**: `CircleGeometry(0.55, 24)` rotated flat (`rotation.x = -PI/2`), `MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })`, positioned each frame at `(x, 0.03, 0)`.
- **Altitude line**: `THREE.Line` from `(x, 0.05, 0)` to `(x, y - 0.25, 0)`, `LineBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.5 })`. Update the two vertex positions each frame (`geometry.attributes.position.setXYZ(...)` + `needsUpdate = true`).
- `setShadowVisible(v: boolean)` — game hides blob+line over space segments.
- `setBlink(t: number | null)` — during invulnerability game calls with elapsed time: `mesh.visible = Math.floor(t * 10) % 2 === 0`; with `null` → `mesh.visible = true`.
- `reset()` → `x = 0, y = 1.5`, roll/pitch 0.
- Expose `nosePos(): {x, y, z: -0.7}` for bullet spawn.

### 6.7 `turrets.ts`

One exported function, called from game each update while state is `playing`:

```
updateTurrets(dt, dist, world, shipX, shipY, level, canFire: boolean,
              fireEnemy: (fx,fy,fz, tx,ty,tz) => void)
```

For each segment within `[dist - 5, dist + COMBAT.TURRET_RANGE_MAX + 5]`, for each turret with `collider.alive`:
- Turret scene position: `tx = center of collider x`, `ty = collider.maxY * 0.7`, `tz = dist - (collider.minU + collider.maxU)/2`.
- Aim: `mesh.rotation.y = Math.atan2(shipX - tx, 0 - tz)` (ship is at scene z 0; this assumes the barrel faces +Z at rotation 0 — flip by adding `Math.PI` if visually backwards).
- `cooldown -= dt`. If `cooldown <= 0` and `canFire` and `(turretU - dist)` is within `[TURRET_RANGE_MIN, TURRET_RANGE_MAX]`:
  - `fireEnemy(tx, ty, tz, shipX, shipY, 0)`;
  - `cooldown = turretCooldown(level) * (double ? 0.6 : 1) * (0.8 + Math.random() * 0.4)`.

### 6.8 `bullets.ts`

Two pools of simple meshes added to the scene.

- Player bullets: `BoxGeometry(0.12, 0.12, 0.7)`, `MeshBasicMaterial({ color: COLORS.PLAYER_BULLET })`. Pool size `COMBAT.PLAYER_POOL`. Entry: `{ mesh, active, ttl }`. All spawned with `mesh.visible = false` initially.
- Enemy bullets: `SphereGeometry(0.14, 8, 8)`, color `ENEMY_BULLET`, pool `COMBAT.ENEMY_POOL`, entry has `vel: THREE.Vector3`.

API:
- `firePlayer(x, y, z)`: grab first inactive entry (if none, ignore); position mesh; `ttl = BULLET_TTL`; visible.
- `fireEnemy(fx,fy,fz, tx,ty,tz)`: velocity = `normalize(target - from) * ENEMY_BULLET_SPEED`; same pooling.
- `update(dt)`: player bullets `mesh.position.z -= PLAYER_BULLET_SPEED * dt`; enemy bullets `pos += vel*dt`; both `ttl -= dt`; deactivate when `ttl <= 0` or `|z| > 90`.
- `deactivate(entry)`, `clearAll()`, and iteration access for game collision checks: `forEachActivePlayer(cb)`, `forEachActiveEnemy(cb)`.

### 6.9 `aircraft.ts`

Scene-space entities, only spawned while the segment under the ship is `'space'`.

State: `list: { mesh, baseX, y, z, phase, t, alive }[]`, `spawnTimer`.

- `update(dt, dist, inSpace, level, scroll)`:
  - If `inSpace`: `spawnTimer -= dt`; when ≤ 0: `spawnTimer = waveInterval(level)`; spawn `waveSize(level)` racers: clone `racer`, `baseX = rand lane -4..4`, `y = rand 0.8..4.2`, `z = -70 - rand*10`, `phase = rand*2π`.
  - Each craft: `t += dt`; `z += (scroll + AIRCRAFT_SPEED) * dt`; `x = clamp(baseX + Math.sin(t * 1.8 + phase) * 1.2, -5, 5)`; set mesh position; small roll: `mesh.rotation.z = Math.sin(t * 1.8 + phase) * -0.3`.
  - Remove (mesh from scene, entry from list) when `z > 15`.
- Collision data: expose list; each craft AABB half-extents `(0.45, 0.25, 0.65)`.
- `killAt(craft)` → remove + return position for fx. `clearAll()`.
- On wave spawn call the audio flyby hook (pass a callback or return a flag).

### 6.10 `fx.ts`

- `explode(scene, pos: Vector3, big: boolean)`: spawn ~14 (big: 22) small `BoxGeometry(0.15)` meshes, `MeshBasicMaterial` colored randomly from `[0xffb347, 0xff6b35, 0xe8e8e8, 0x6b6b6b]`, at `pos`; each gets velocity: random direction, speed 2–6, `vy += rand 1..4`; life 0.9 s. Plus one flash: `SphereGeometry(0.3)`, `MeshBasicMaterial({ color: 0xffd27a, transparent: true })` scaling to 6× (big: 9×) and fading to 0 over 0.25 s.
- `update(dt)`: integrate particles (`vy -= 9 * dt`), scale down linearly with life, remove dead ones from scene.
- `clear()`.

### 6.11 `audio.ts`

Lazy `AudioContext` (create on first call; also call `ctx.resume()` — browsers require a user gesture, and the first call always follows a keypress). Master `GainNode` at 0.35. `muted` flag persisted to `localStorage('haxxon.mute')`; when muted, master gain 0.

Recipes (each creates nodes, starts, and schedules `stop`; times relative to `ctx.currentTime`):
- `laser()`: square osc, freq 660 → exponentialRamp to 180 over 0.09 s; gain 0.22 → exp ramp 0.001 at 0.09 s.
- `explosion()`: 0.5 s white-noise `AudioBuffer` through a lowpass filter, freq 900 → 120 over 0.45 s; gain 0.6 → 0.001 over 0.45 s.
- `hit()`: 0.12 s noise through highpass 1000 Hz, gain 0.25 → 0.001.
- `refuel()`: two sine blips: 520 Hz at t0, 780 Hz at t0+0.08, each 0.07 s, gain 0.2.
- `lowFuel()`: triangle 220 Hz, 0.15 s, gain 0.3. (Game calls this at most once per second while fuel low.)
- `flyby()`: sawtooth 900 → 200 Hz over 0.5 s, gain 0.1.
- `gameOver()`: triangle 440 → 110 Hz over 0.8 s, gain 0.3.
- `toggleMute(): boolean`.

### 6.12 `hud.ts`

Cache all element refs by id at construction. Methods (all trivial DOM writes):
- `setScore(n)`, `setHiScore(n)` — zero-pad to 6 (`String(n).padStart(6, '0')`).
- `setLives(n)` — `livesPanel.textContent = '▲'.repeat(Math.max(0, n))`.
- `setLevel(n)`, `setFuel(frac)` (width %, add/remove `.low` class when `frac < FUEL.LOW / FUEL.MAX`), `setAltitude(frac)` (alt-fill height %).
- `setLoading(frac)`; `show(name)` / `hide(name)` for overlays `loading|title|gameover|paused|hud`.
- `flash(msg)` — set text, opacity 1, then fade after 1.2 s (store timeout, reset on re-flash).
- `setGameOver(score, hi, isNewHi)` — fill spans; if new high score set the hi-line text to `NEW HIGH SCORE! ${hi}`.
- `setTitleHiScore(n)`.

### 6.13 `game.ts` — the hub (most important logic; follow exactly)

Constructed with: scene, camera, world, director, player, bullets, aircraft, fx, hud, audio, input.

State fields: `state: 'title'|'playing'|'dying'|'gameover'`, `dist = 0`, `score`, `hiscore` (from `localStorage('haxxon.hiscore')`), `lives`, `fuel`, `fireCd`, `invulnT` (time left), `deathT`, `paused`, `lowFuelBeepT`.

**`update(dt)`** — called by the fixed-step loop:

1. Global keys (any state): `consume('KeyM')` → `audio.toggleMute()`, `hud.flash(muted ? 'MUTED' : 'SOUND ON')`. `consume('KeyI')` → `input.toggleInvert()`, flash `INVERT ON/OFF`.
2. `title`: scroll slowly `dist += GAME.ATTRACT_SCROLL * dt`; `world.ensure(dist)`; `world.updateSpinners(dt)`; if `consume('Space')` → `startRun()`.
3. `paused` check (only in `playing`): `consume('KeyP')` toggles `paused` + overlay; if paused, return.
4. `playing`:
   - `speed = scrollSpeed(director.level)`; `dist += speed * dt`; `world.ensure(dist)`; `world.updateSpinners(dt)`.
   - `const seg = world.segmentAt(dist)`; `const inSpace = seg?.kind === 'space'`.
   - Level display: `hud.setLevel(director.level)`.
   - Player: `player.update(dt, input.moveX(), input.moveY())`; `player.setShadowVisible(!inSpace)`.
   - Invulnerability: if `invulnT > 0`: `invulnT -= dt`; `player.setBlink(invulnT > 0 ? invulnT : null)`.
   - Fire: `fireCd -= dt`; if `input.fireHeld()` and `fireCd <= 0`: `bullets.firePlayer(player.x, player.y, -0.7)`; `audio.laser()`; `fireCd = COMBAT.FIRE_COOLDOWN`.
   - `bullets.update(dt)`; `aircraft.update(dt, dist, inSpace, director.level, speed)` (audio.flyby on new wave); `turrets: updateTurrets(dt, dist, world, player.x, player.y, director.level, /*canFire*/ invulnT <= 0, bullets.fireEnemy)`; `fx.update(dt)`.
   - Fuel: `fuel -= FUEL.DRAIN * dt`; `hud.setFuel(fuel / FUEL.MAX)`; if `fuel < FUEL.LOW`: `lowFuelBeepT -= dt`; if ≤ 0 { `audio.lowFuel()`; `lowFuelBeepT = 1` }. If `fuel <= 0` → `die()` and return.
   - `hud.setAltitude((player.y - SHIP.MIN_Y) / (SHIP.MAX_Y - SHIP.MIN_Y))`.
   - **Player bullets vs world + aircraft**: for each active player bullet: `u = dist - mesh.position.z`; for each `collidersNear(world.segments, u - 1, u + 1)`: if `pointHits(bx, by, u, c, COMBAT.HIT_INFLATE)`:
     - if `c.hp > 0` (destructible): `c.hp -= 1`; if 0: `world.destroyCollider(c)`; `addScore(c.points)`; if `c.fuel > 0` { `fuel = min(FUEL.MAX, fuel + c.fuel)`; `audio.refuel()`; `hud.flash('FUEL +' + c.fuel)` } else `audio.hit()`; `fx.explode(scene, sceneCenterOf(c), false)` — scene position: `(cx, cy, dist - cu)`.
     - else (wall/decor): `audio.hit()` (quiet thunk), small fx optional.
     - Either way deactivate the bullet; break.
     Then vs aircraft: AABB check in scene space (`|bx - ax| < 0.45+0.1` etc.); on hit: kill craft, `fx.explode`, `addScore(POINTS.AIRCRAFT)`, `audio.explosion()`, deactivate bullet.
   - **Ship collisions** (skip all if `invulnT > 0`):
     - Floor: if `!inSpace && player.y < SHIP.CRASH_Y` → `die()`.
     - World: ship AABB = `x±0.5, y±0.2, u = dist±0.55`; `boxOverlap` vs `collidersNear(segments, dist-2, dist+2)` → any hit → `die()`.
     - Aircraft: AABB overlap scene-space → `die()` (also destroy that craft with fx).
     - Enemy bullets: for each active enemy bullet, point-vs-ship-AABB inflated 0.1 → `die()` + deactivate bullet.
5. `dying`: `fx.update(dt)`; `deathT -= dt`; when ≤ 0: if `lives > 0` → respawn: `state='playing'`, `fuel = FUEL.MAX`, `invulnT = GAME.INVULN`, `player.mesh.visible = true`; else → `gameOver()`.
6. `gameover`: `fx.update(dt)`; `consume('KeyR')` → `startRun()`.

**Helpers:**
- `addScore(n)`: `score += n`; `hud.setScore(score)`; if `score > hiscore` { `hiscore = score`; `localStorage.setItem('haxxon.hiscore', String(hiscore))`; `hud.setHiScore(hiscore)` }.
- `die()`: `audio.explosion()`; `fx.explode(scene, playerPos, true)`; `lives -= 1`; `hud.setLives(lives)`; `player.mesh.visible = false`; `state = 'dying'`; `deathT = GAME.DEATH_PAUSE`. (Scrolling stops automatically because only `playing` advances `dist`.)
- `startRun()`: `world.clear()`; `director.reset()`; `bullets.clearAll()`; `aircraft.clearAll()`; `fx.clear()`; `dist = 0`; `world.ensure(dist)`; `score = 0`; `lives = GAME.START_LIVES`; `fuel = FUEL.MAX`; `invulnT = 0`; `fireCd = 0`; `player.reset()`; `player.mesh.visible = true`; hud: hide title/gameover, show hud, set score/lives/level/fuel; `state = 'playing'`.
- `gameOver()`: `audio.gameOver()`; `hud.setGameOver(score, hiscore, score === hiscore && score > 0)`; show gameover overlay; `state = 'gameover'`.
- `showTitle()` (called once after loading): set title hiscore, show title overlay + hud hidden; `state = 'title'`; `world.ensure(0)`.

### 6.14 `main.ts`

1. Renderer: `new THREE.WebGLRenderer({ antialias: true })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`, `setSize(innerWidth, innerHeight)`, append to `#app`.
2. Scene: `background = new THREE.Color(COLORS.BG)`; `fog = new THREE.Fog(COLORS.FOG, FOG_NEAR, FOG_FAR)`.
3. Camera: 
   ```ts
   const aspect = innerWidth / innerHeight;
   const h = CAMERA.VIEW_HEIGHT;
   const camera = new THREE.OrthographicCamera(-h*aspect/2, h*aspect/2, h/2, -h/2, CAMERA.NEAR, CAMERA.FAR);
   camera.position.set(CAMERA.OFFSET.x, CAMERA.OFFSET.y, CAMERA.OFFSET.z);
   camera.lookAt(CAMERA.LOOK_AT.x, CAMERA.LOOK_AT.y, CAMERA.LOOK_AT.z);
   ```
   On `resize`: update renderer size and the four frustum planes (recompute with new aspect) + `updateProjectionMatrix()`.
4. Lights: `HemisphereLight(0xbfd4ff, 0x30281e, 1.1)` + `DirectionalLight(0xffffff, 1.6)` at `(15, 30, 10)` (no shadows).
5. **Starfield**: `BufferGeometry` with 900 random points in box x∈[-120,120], y∈[-70,25], z∈[-160,40]; `PointsMaterial({ color: COLORS.STARS, size: 0.18, sizeAttenuation: false })`... use `size: 2, sizeAttenuation: false` (pixel size with ortho). Add to scene.
6. `await loadAll(frac => hud.setLoading(frac))` → then hide loading overlay, construct all modules, `game.showTitle()`, `startLoop(dt => game.update(dt), () => renderer.render(scene, camera))`.
7. Wrap bootstrap in an async IIFE with try/catch that writes any error message into the loading overlay (so failures are visible).

---

## 7. Milestones — build in this order, verify each before continuing

Each milestone ends with `npm run dev` and a browser check. Do not proceed while a milestone's verification fails. (`npm run build` must also pass typecheck at every milestone.)

**M0 — Scaffold.** Create `.gitignore`, `tsconfig.json`, `index.html`, `style.css`, minimal `main.ts` (renderer + empty scene + resize + rAF render). All overlays except loading hidden.
*Verify: solid dark background, no console errors.*

**M1 — Iso camera + assets.** Add `config.ts`, `types.ts`, `core/assets.ts`, camera/lights/starfield per §6.14. Load ALL manifest models with the loading bar. Temporarily place the prepared `ship` clone at origin and a few other clones (turret, silo, wall block) on a `GridHelper(20, 20)`; rotate the ship slowly in the render loop.
*Verify: loading bar fills then disappears; models sit ON the grid (bases at y=0, centered) at sane relative sizes; classic iso diagonal view; ship nose points upper-right (−Z) — if backwards, flip its `yaw` in the manifest. Remove the temp scene content afterwards.*

**M2 — Scrolling world.** Add `core/loop.ts`, `world.ts`, `builder.ts` (fortress floor + walls only is enough at first), `segments.ts`, `director.ts`. Drive with a hardcoded `dist += 6.5 * dt`. Temporarily set `REBASE_AT = 60` to exercise rebasing, then restore 512.
*Verify: endless diagonal scroll toward lower-left; segments appear/disappear; no visual pop when rebase triggers; `renderer.info.render.calls` stays bounded (< ~800) over minutes.*

**M3 — Player + shadow.** Add `core/input.ts`, `player.ts`. Ship fixed at scene z 0; move with keys; shadow blob + altitude line; wire `hud.ts` altitude meter + fuel bar (static full).
*Verify: both axes move with correct signs; `I` inverts climb; banking looks natural; shadow stays on the floor directly below the ship — altitude readable at a glance.*

**M4 — Collisions + death + lives.** Full `builder.ts` legend (turrets/fuel/decor/gate as static props), `collision.ts`, `fx.ts`, death flow in `game.ts` (states title/playing/dying/gameover minus scoring), floor crash, respawn-in-place with blink, R-restart.
*Verify: hitting any wall/prop or diving into the floor explodes the ship; scrolling pauses during explosion; respawn continues at the same spot with blinking; 3 deaths → game over; R restarts with a clean world.*

**M5 — Shooting + fuel + score.** `bullets.ts` player pool; bullet-vs-collider destruction; fuel drain/refill; score + high score persistence; low-fuel warning.
*Verify: shooting a silo refills fuel visibly and scores 300; bullets stop on walls; must match altitude to hit things (fly low for barrels); empty tank kills; high score survives a page reload.*

**M6 — Turrets fire.** `turrets.ts` + enemy pool in `bullets.ts` + ship-vs-enemy-bullet check.
*Verify: turrets rotate to track you and fire when you approach; shots are dodgeable with either axis; getting hit costs a life; turrets stop firing while you're dead/invulnerable.*

**M7 — Space sections + aircraft + level flow.** `buildSpace`, spinners, `aircraft.ts`, director level sequencing, per-level difficulty, gate segment at fortress end.
*Verify: after ~8 fortress segments you fly through the gate into open space (stars below, no floor, no floor-crash); meteors tumble toward you and can be shot; racer waves weave in (facing the right way — else flip yaw); after 4 space segments the next fortress starts and LEVEL increments; level 2 is noticeably faster/denser.*

**M8 — Title, audio, polish.** `audio.ts` wired to all events, title/game-over overlays, attract-mode scroll behind the title, pause, mute/invert flashes, final tuning pass (feel free to adjust config numbers ±30% if the game feels too hard/easy — config only, no logic changes).
*Verify (full end-to-end): title → space starts a run → play a full level loop → die three ways (wall, floor, enemy fire) → fuel death → game over → new high score shown and persisted → R restarts. 60 fps, draw calls < 800, no memory growth over 5 minutes (watch `renderer.info.memory.geometries` stay flat).*

## 8. Known pitfalls (avoid these specific mistakes)

1. **Do not** move the ship or camera along Z. Only `world.group.position.z` and scene-space projectiles/aircraft move.
2. **Do not** forget `u = dist − sceneZ` sign conventions; things AHEAD have u > dist and negative scene z.
3. **Do not** call `.dispose()` on geometries/materials from loaded GLTFs — they are shared by every clone.
4. `Box3.setFromObject` before adding to the scene is fine (it updates world matrices itself), but recenter BEFORE applying yaw/scale, in the wrapper structure given in §5.3.
5. Ortho camera zoom = frustum size, not camera distance. Resize must recompute left/right/top/bottom from aspect.
6. `AudioContext` must be created/resumed inside a key handler path (autoplay policy) — lazy init on first SFX call is sufficient since every SFX follows input.
7. The `barrel` model is tiny — its collider values in the legend already account for the 1.8× scale; don't rescale colliders again.
8. Segment rows are strings; `def.rows[r][c]` indexing — row 0 must be the FIRST row the player reaches (nearest edge, lowest u).
9. Player bullets must be checked against colliders using the bullet's CURRENT u each substep; don't cache u across frames.
10. When the ship dies during a space section, aircraft keep flying (they update in `dying` state? No — they don't: only `fx` updates during `dying`; that is acceptable and simplest).

## 9. Verification commands

- `npm run dev` — manual play-through per milestone above.
- `npm run build` — must pass `tsc --noEmit` clean and produce `dist/` (confirm `dist/models/` contains the GLBs — the `public/models` symlink must be followed; if Vite does not copy symlinked files, replace the symlink with a real copy: `rm public/models && cp -R models public/models`).
- Optional headless screenshot for visual checks (ship orientation, camera framing): `npx playwright screenshot --viewport-size=1280,720 --wait-for-timeout=4000 http://localhost:5173 shot.png` (requires `npx playwright install chromium` once).
