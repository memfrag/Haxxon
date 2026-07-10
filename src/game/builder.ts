import * as THREE from 'three';
import { clone } from '../core/assets';
import type { ModelName } from '../core/assets';
import {
  SEG_ROWS, SEG_LEN, LANES, COLORS, POINTS, REFILL, meteorCount, AIRCRAFT_SPEED,
} from '../config';
import type { Collider, Segment, SegmentDef, TurretEntity, Spinner } from '../types';

// silence unused-import complaints for constants referenced only in docs
void AIRCRAFT_SPEED;

const HALF_W = LANES / 2 - 0.5; // = 5, so lane centers are x = c - 5, c in 0..10

function cellCenterX(c: number): number { return c - HALF_W; }
function cellCenterZ(r: number): number { return -(r + 0.5); }

function place(mesh: THREE.Object3D, x: number, y: number, z: number): void {
  mesh.position.set(x, y, z);
}

function randYaw(mesh: THREE.Object3D): void {
  mesh.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 2;
}

interface DecorSpec { model: ModelName; height: number; half: number }

const DECOR: Record<string, DecorSpec> = {
  d: { model: 'dish', height: 0.85, half: 0.42 },
  m: { model: 'generator', height: 0.7, half: 0.5 },
  h: { model: 'hangar', height: 1.0, half: 1.0 },
  c: { model: 'chimney', height: 2.0, half: 0.2 },
  p: { model: 'pipe', height: 0.6, half: 0.35 },
  s: { model: 'structure', height: 1.0, half: 0.5 },
};

interface FuelSpec { model: ModelName; height: number; half: number; points: number; fuel: number }

const FUEL_CELLS: Record<string, FuelSpec> = {
  b: { model: 'barrel', height: 0.45, half: 0.18, points: POINTS.BARREL, fuel: REFILL.BARREL },
  B: { model: 'barrels', height: 0.46, half: 0.36, points: POINTS.BARRELS, fuel: REFILL.BARRELS },
  F: { model: 'silo', height: 1.4, half: 0.7, points: POINTS.SILO, fuel: REFILL.SILO },
};

function addDecorCollider(
  colliders: Collider[], x: number, start: number, r: number, height: number, half: number,
): void {
  colliders.push({
    kind: 'decor',
    minX: x - half, maxX: x + half,
    minY: 0, maxY: height,
    minU: start + r + 0.5 - half, maxU: start + r + 0.5 + half,
    hp: 0, points: 0, fuel: 0, alive: true,
  });
}

export function buildFortress(def: SegmentDef, start: number): Segment {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const turrets: TurretEntity[] = [];

  // Floor plane (rows extend toward local -z; plane centered at -SEG_LEN/2).
  const floorGeo = new THREE.PlaneGeometry(LANES + 2, SEG_LEN);
  const floorMat = new THREE.MeshLambertMaterial({ color: COLORS.FLOOR });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, -SEG_LEN / 2);
  group.add(floor);

  // Fortress rim edges.
  const edgeMat = new THREE.MeshLambertMaterial({ color: COLORS.FLOOR_EDGE });
  for (const sx of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, SEG_LEN), edgeMat);
    edge.position.set(sx * (LANES / 2 + 0.8), -0.3, -SEG_LEN / 2);
    group.add(edge);
  }

  // Cells.
  for (let r = 0; r < SEG_ROWS; r++) {
    const row = def.rows[r];
    // Walls: merge contiguous same-digit runs into single colliders.
    let runChar = '';
    let runStart = -1;
    const flushRun = (endCol: number) => {
      if (runChar === '' || runStart < 0) return;
      const n = +runChar;
      const minX = cellCenterX(runStart) - 0.5;
      const maxX = cellCenterX(endCol) + 0.5;
      colliders.push({
        kind: 'wall',
        minX, maxX, minY: 0, maxY: n,
        minU: start + r, maxU: start + r + 1,
        hp: 0, points: 0, fuel: 0, alive: true,
      });
      runChar = '';
      runStart = -1;
    };

    for (let c = 0; c < LANES; c++) {
      const ch = row[c];
      const x = cellCenterX(c);
      const z = cellCenterZ(r);

      // wall-run bookkeeping
      if (ch >= '1' && ch <= '4') {
        if (ch !== runChar) { flushRun(c - 1); runChar = ch; runStart = c; }
        // build stacked wall visuals for this cell
        const n = +ch;
        for (let k = 0; k < n; k++) {
          const block = clone('wall');
          place(block, x, k, z);
          group.add(block);
        }
        const roof = clone('wallRoof');
        place(roof, x, n, z);
        group.add(roof);
        continue;
      } else {
        flushRun(c - 1);
      }

      if (ch === '.') continue;

      if (ch === 't' || ch === 'T') {
        const double = ch === 'T';
        const mesh = clone(double ? 'turretDouble' : 'turret');
        const half = double ? 0.4 : 0.32;
        const height = double ? 0.9 : 1.1;
        place(mesh, x, 0, z);
        group.add(mesh);
        const collider: Collider = {
          kind: 'turret',
          minX: x - half, maxX: x + half,
          minY: 0, maxY: height,
          minU: start + r + 0.5 - half, maxU: start + r + 0.5 + half,
          hp: double ? 2 : 1,
          points: double ? POINTS.TURRET_DOUBLE : POINTS.TURRET_SINGLE,
          fuel: 0, alive: true, mesh,
        };
        colliders.push(collider);
        turrets.push({ collider, mesh, double, cooldown: Math.random() * 1.5 });
        continue;
      }

      const fuel = FUEL_CELLS[ch];
      if (fuel) {
        const mesh = clone(fuel.model);
        randYaw(mesh);
        place(mesh, x, 0, z);
        group.add(mesh);
        colliders.push({
          kind: 'fuel',
          minX: x - fuel.half, maxX: x + fuel.half,
          minY: 0, maxY: fuel.height,
          minU: start + r + 0.5 - fuel.half, maxU: start + r + 0.5 + fuel.half,
          hp: 1, points: fuel.points, fuel: fuel.fuel, alive: true, mesh,
        });
        continue;
      }

      const decor = DECOR[ch];
      if (decor) {
        const mesh = clone(decor.model);
        randYaw(mesh);
        place(mesh, x, 0, z);
        group.add(mesh);
        addDecorCollider(colliders, x, start, r, decor.height, decor.half);
        continue;
      }

      if (ch === 'R') {
        const stack = new THREE.Group();
        const base = clone('rocketBase'); base.position.y = 0; stack.add(base);
        const sides = clone('rocketSides'); sides.position.y = 1.6; stack.add(sides);
        const top = clone('rocketTop'); top.position.y = 2.6; stack.add(top);
        place(stack, x, 0, z);
        group.add(stack);
        addDecorCollider(colliders, x, start, r, 3.4, 0.9);
        continue;
      }

      // Non-colliding floor decor.
      if (ch === 'x') { const mesh = clone('crater'); randYaw(mesh); place(mesh, x, 0, z); group.add(mesh); continue; }
      if (ch === 'k') { const mesh = clone('rocksSmall'); randYaw(mesh); place(mesh, x, 0, z); group.add(mesh); continue; }
      if (ch === 'o') { const mesh = clone('rock'); randYaw(mesh); place(mesh, x, 0, z); group.add(mesh); continue; }
    }
    flushRun(LANES - 1);
  }

  // Gate arch (visual only).
  if (def.gate !== undefined) {
    const gate = clone('gate');
    place(gate, 0.5, 0, cellCenterZ(def.gate));
    group.add(gate);
  }

  decorateGround(group, def);

  return { kind: 'fortress', start, len: SEG_LEN, group, colliders, turrets, spinners: [] };
}

const GROUND_DETAIL: { model: ModelName; weight: number }[] = [
  { model: 'ground', weight: 3 },
  { model: 'craterSmall', weight: 2 },
  { model: 'crater', weight: 1 },
  { model: 'rock', weight: 2 },
  { model: 'rocksSmall', weight: 2 },
  { model: 'rocksSmallB', weight: 2 },
  { model: 'rockLarge', weight: 1 },
  { model: 'rockLargeB', weight: 1 },
];
const GROUND_DETAIL_TOTAL = GROUND_DETAIL.reduce((s, d) => s + d.weight, 0);

function pickGroundDetail(): ModelName {
  let roll = Math.random() * GROUND_DETAIL_TOTAL;
  for (const d of GROUND_DETAIL) { roll -= d.weight; if (roll <= 0) return d.model; }
  return GROUND_DETAIL[0].model;
}

// Carpet the empty ground with road runs + scattered craters/rocks/terrain (non-solid, no colliders).
function decorateGround(group: THREE.Group, def: SegmentDef): void {
  const filled: boolean[][] = [];
  for (let r = 0; r < SEG_ROWS; r++) {
    filled.push([]);
    for (let c = 0; c < LANES; c++) filled[r][c] = def.rows[r][c] !== '.';
  }

  // Road runs down the two emptiest lanes (roads run along the travel axis).
  const laneEmptiness = (c: number) => {
    let n = 0;
    for (let r = 0; r < SEG_ROWS; r++) if (!filled[r][c]) n++;
    return n;
  };
  const lanes = Array.from({ length: LANES }, (_, i) => i)
    .sort((a, b) => laneEmptiness(b) - laneEmptiness(a));
  for (const c of lanes.slice(0, 2)) {
    for (let r = 0; r < SEG_ROWS; r++) {
      if (filled[r][c]) continue;
      const road = clone('road');
      place(road, cellCenterX(c), 0, cellCenterZ(r));
      group.add(road);
      filled[r][c] = true;
    }
  }

  // Scatter surface detail on the remaining bare cells.
  for (let r = 0; r < SEG_ROWS; r++) {
    for (let c = 0; c < LANES; c++) {
      if (filled[r][c] || Math.random() > 0.15) continue;
      const mesh = clone(pickGroundDetail());
      randYaw(mesh);
      place(mesh, cellCenterX(c), 0, cellCenterZ(r));
      group.add(mesh);
      filled[r][c] = true;
    }
  }
}

const METEOR_MODELS: ModelName[] = ['meteor', 'meteorB', 'meteorHalf', 'rockLarge'];

function rand(min: number, max: number): number { return min + Math.random() * (max - min); }

export function buildSpace(start: number, level: number): Segment {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const spinners: Spinner[] = [];

  const n = meteorCount(level);
  const rows: number[] = [];
  for (let r = 2; r <= 21; r++) rows.push(r);
  // shuffle
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  for (let i = 0; i < n && i < rows.length; i++) {
    const row = rows[i];
    const col = Math.floor(Math.random() * LANES);
    const x = cellCenterX(col);
    const y = rand(0.6, 4.6);
    const s = rand(1.0, 2.2);
    const model = METEOR_MODELS[Math.floor(Math.random() * METEOR_MODELS.length)];
    const mesh = clone(model);
    mesh.scale.multiplyScalar(s);
    const z = cellCenterZ(row);
    mesh.position.set(x, y - 0.36 * s, z);
    group.add(mesh);

    colliders.push({
      kind: 'meteor',
      minX: x - 0.45 * s, maxX: x + 0.45 * s,
      minY: y - 0.4 * s, maxY: y + 0.4 * s,
      minU: start + row + 0.5 - 0.45 * s, maxU: start + row + 0.5 + 0.45 * s,
      hp: s > 1.6 ? 2 : 1, points: POINTS.METEOR, fuel: 0, alive: true, mesh,
    });
    spinners.push({ mesh, ax: rand(-1, 1), ay: rand(-1, 1), speed: rand(0.3, 1.2) });
  }

  return { kind: 'space', start, len: SEG_LEN, group, colliders, turrets: [], spinners };
}
