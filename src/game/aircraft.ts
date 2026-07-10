import * as THREE from 'three';
import { clone } from '../core/assets';
import { waveInterval, waveSize, AIRCRAFT_SPEED } from '../config';

interface Craft {
  mesh: THREE.Group;
  baseX: number;
  y: number;
  z: number;
  phase: number;
  t: number;
}

export const CRAFT_HALF = { x: 0.45, y: 0.25, z: 0.65 };

function rand(min: number, max: number): number { return min + Math.random() * (max - min); }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

export class Aircraft {
  list: Craft[] = [];
  private spawnTimer = 0;

  constructor(private scene: THREE.Scene) {}

  /** Returns true on frames where a new wave spawned (for audio). */
  update(dt: number, inSpace: boolean, level: number, scroll: number): boolean {
    let spawned = false;
    if (inSpace) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = waveInterval(level);
        const count = waveSize(level);
        for (let i = 0; i < count; i++) {
          const mesh = clone('racer');
          const baseX = rand(-4, 4);
          const y = rand(0.8, 4.2);
          const z = -70 - Math.random() * 10 - i * 4;
          mesh.position.set(baseX, y, z);
          this.scene.add(mesh);
          this.list.push({ mesh, baseX, y, z, phase: Math.random() * Math.PI * 2, t: 0 });
        }
        spawned = true;
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.t += dt;
      c.z += (scroll + AIRCRAFT_SPEED) * dt;
      const x = clamp(c.baseX + Math.sin(c.t * 1.8 + c.phase) * 1.2, -5, 5);
      c.mesh.position.set(x, c.y, c.z);
      c.mesh.rotation.z = Math.sin(c.t * 1.8 + c.phase) * -0.3;
      if (c.z > 15) {
        this.scene.remove(c.mesh);
        this.list.splice(i, 1);
      }
    }
    return spawned;
  }

  removeCraft(c: Craft): void {
    this.scene.remove(c.mesh);
    const idx = this.list.indexOf(c);
    if (idx >= 0) this.list.splice(idx, 1);
  }

  clearAll(): void {
    for (const c of this.list) this.scene.remove(c.mesh);
    this.list = [];
    this.spawnTimer = 0;
  }
}

export type { Craft };
