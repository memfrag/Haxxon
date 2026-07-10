import { COMBAT, turretCooldown } from '../config';
import type { World } from './world';

type FireEnemy = (fx: number, fy: number, fz: number, tx: number, ty: number, tz: number) => void;

export function updateTurrets(
  dt: number,
  dist: number,
  world: World,
  shipX: number,
  shipY: number,
  level: number,
  canFire: boolean,
  fireEnemy: FireEnemy,
): void {
  const u0 = dist - 5;
  const u1 = dist + COMBAT.TURRET_RANGE_MAX + 5;
  for (const seg of world.segments) {
    if (seg.start > u1 || seg.start + seg.len < u0) continue;
    for (const t of seg.turrets) {
      if (!t.collider.alive) continue;
      const c = t.collider;
      const cu = (c.minU + c.maxU) / 2;
      const tx = (c.minX + c.maxX) / 2;
      const ty = c.maxY * 0.7;
      const tz = dist - cu;
      // Aim toward the ship (barrel assumed facing +Z at rotation 0).
      t.mesh.rotation.y = Math.atan2(shipX - tx, 0 - tz);

      t.cooldown -= dt;
      const ahead = cu - dist;
      if (t.cooldown <= 0 && canFire
          && ahead >= COMBAT.TURRET_RANGE_MIN && ahead <= COMBAT.TURRET_RANGE_MAX) {
        fireEnemy(tx, ty, tz, shipX, shipY, 0);
        t.cooldown = turretCooldown(level) * (t.double ? 0.6 : 1) * (0.8 + Math.random() * 0.4);
      }
    }
  }
}
