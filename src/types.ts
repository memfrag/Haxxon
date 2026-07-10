import type * as THREE from 'three';

export type ColliderKind = 'wall' | 'decor' | 'turret' | 'fuel' | 'meteor';

export interface Collider {
  kind: ColliderKind;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minU: number; maxU: number;   // cumulative distance space (see IMPLEMENTATION §2.3)
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

export interface Spinner {
  mesh: THREE.Object3D;
  ax: number; ay: number; speed: number;
}

export interface Segment {
  kind: SegmentKind;
  start: number;                // u position of the segment's near edge
  len: number;
  group: THREE.Group;
  colliders: Collider[];
  turrets: TurretEntity[];
  spinners: Spinner[];          // meteors
}

export interface SegmentDef {
  rows: string[];               // SEG_ROWS strings of LANES chars; row 0 = reached first
  diff: number;                 // 0..3
  gate?: number;                // row index that gets the gate arch mesh
}
