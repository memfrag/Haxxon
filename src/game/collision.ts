import type { Collider, Segment } from '../types';

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
