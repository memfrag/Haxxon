import * as THREE from 'three';
import { SPAWN_AHEAD, DESPAWN_BEHIND, REBASE_AT } from '../config';
import type { Collider, Segment } from '../types';
import { Director } from './director';
import { buildFortress, buildSpace } from './builder';

export class World {
  group = new THREE.Group();
  segments: Segment[] = [];
  private rebaseOff = 0;
  private nextStart = 0;

  constructor(private director: Director) {}

  ensure(dist: number): void {
    // Spawn ahead.
    while (this.nextStart < dist + SPAWN_AHEAD) {
      const req = this.director.next();
      const seg = req.kind === 'fortress'
        ? buildFortress(req.def, this.nextStart)
        : buildSpace(this.nextStart, this.director.level);
      seg.group.position.z = -(seg.start - this.rebaseOff);
      this.group.add(seg.group);
      this.segments.push(seg);
      this.nextStart += seg.len;
    }

    // Recycle behind.
    while (this.segments.length > 0
        && this.segments[0].start + this.segments[0].len < dist - DESPAWN_BEHIND) {
      const seg = this.segments.shift()!;
      this.group.remove(seg.group);
    }

    // Rebase to keep local coordinates small.
    if (dist - this.rebaseOff > REBASE_AT) {
      this.rebaseOff = dist;
      for (const seg of this.segments) {
        seg.group.position.z = -(seg.start - this.rebaseOff);
      }
    }

    this.group.position.z = dist - this.rebaseOff;
  }

  segmentAt(u: number): Segment | undefined {
    for (const seg of this.segments) {
      if (u >= seg.start && u < seg.start + seg.len) return seg;
    }
    return undefined;
  }

  updateSpinners(dt: number): void {
    for (const seg of this.segments) {
      for (const sp of seg.spinners) {
        sp.mesh.rotation.x += sp.ax * sp.speed * dt;
        sp.mesh.rotation.y += sp.ay * sp.speed * dt;
      }
    }
  }

  destroyCollider(c: Collider): void {
    c.alive = false;
    if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
  }

  clear(): void {
    for (const seg of this.segments) this.group.remove(seg.group);
    this.segments = [];
    this.nextStart = 0;
    this.rebaseOff = 0;
    this.group.position.z = 0;
  }
}
