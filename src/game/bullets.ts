import * as THREE from 'three';
import { COMBAT, COLORS } from '../config';

interface PlayerBullet { mesh: THREE.Mesh; active: boolean; ttl: number }
interface EnemyBullet { mesh: THREE.Mesh; active: boolean; ttl: number; vel: THREE.Vector3 }

export class Bullets {
  private player: PlayerBullet[] = [];
  private enemy: EnemyBullet[] = [];

  constructor(scene: THREE.Scene) {
    const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.7);
    const pMat = new THREE.MeshBasicMaterial({ color: COLORS.PLAYER_BULLET });
    for (let i = 0; i < COMBAT.PLAYER_POOL; i++) {
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.visible = false;
      scene.add(mesh);
      this.player.push({ mesh, active: false, ttl: 0 });
    }

    const eGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const eMat = new THREE.MeshBasicMaterial({ color: COLORS.ENEMY_BULLET });
    for (let i = 0; i < COMBAT.ENEMY_POOL; i++) {
      const mesh = new THREE.Mesh(eGeo, eMat);
      mesh.visible = false;
      scene.add(mesh);
      this.enemy.push({ mesh, active: false, ttl: 0, vel: new THREE.Vector3() });
    }
  }

  firePlayer(x: number, y: number, z: number): void {
    const b = this.player.find((e) => !e.active);
    if (!b) return;
    b.active = true;
    b.ttl = COMBAT.BULLET_TTL;
    b.mesh.visible = true;
    b.mesh.position.set(x, y, z);
  }

  fireEnemy(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number): void {
    const b = this.enemy.find((e) => !e.active);
    if (!b) return;
    b.active = true;
    b.ttl = COMBAT.BULLET_TTL;
    b.mesh.visible = true;
    b.mesh.position.set(fx, fy, fz);
    b.vel.set(tx - fx, ty - fy, tz - fz).normalize().multiplyScalar(COMBAT.ENEMY_BULLET_SPEED);
  }

  update(dt: number): void {
    for (const b of this.player) {
      if (!b.active) continue;
      b.mesh.position.z -= COMBAT.PLAYER_BULLET_SPEED * dt;
      b.ttl -= dt;
      if (b.ttl <= 0 || Math.abs(b.mesh.position.z) > 90) this.deactivatePlayer(b);
    }
    for (const b of this.enemy) {
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.ttl -= dt;
      if (b.ttl <= 0 || Math.abs(b.mesh.position.z) > 90) this.deactivateEnemy(b);
    }
  }

  deactivatePlayer(b: PlayerBullet): void { b.active = false; b.mesh.visible = false; }
  deactivateEnemy(b: EnemyBullet): void { b.active = false; b.mesh.visible = false; }

  forEachActivePlayer(cb: (b: PlayerBullet) => void): void {
    for (const b of this.player) if (b.active) cb(b);
  }
  forEachActiveEnemy(cb: (b: EnemyBullet) => void): void {
    for (const b of this.enemy) if (b.active) cb(b);
  }

  clearAll(): void {
    for (const b of this.player) this.deactivatePlayer(b);
    for (const b of this.enemy) this.deactivateEnemy(b);
  }
}

export type { PlayerBullet, EnemyBullet };
