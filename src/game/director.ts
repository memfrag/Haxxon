import { GAME } from '../config';
import { START_DEF, GATE_DEF, FORTRESS_POOL } from './segments';
import type { SegmentDef } from '../types';

export type SegmentRequest =
  | { kind: 'fortress'; def: SegmentDef }
  | { kind: 'space' };

export class Director {
  level = 1;
  private seqIndex = 0;

  reset(): void {
    this.level = 1;
    this.seqIndex = 0;
  }

  private pickFortress(): SegmentDef {
    const target = Math.min(3, this.level);
    let totalWeight = 0;
    const weights = FORTRESS_POOL.map((def) => {
      const w = Math.max(0.25, 1.5 - Math.abs(def.diff - target));
      totalWeight += w;
      return w;
    });
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < FORTRESS_POOL.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return FORTRESS_POOL[i];
    }
    return FORTRESS_POOL[FORTRESS_POOL.length - 1];
  }

  next(): SegmentRequest {
    const fortressCount = GAME.FORTRESS_SEGS;   // includes entry + gate
    const spaceCount = GAME.SPACE_SEGS;
    const total = fortressCount + spaceCount;
    const idx = this.seqIndex;
    this.seqIndex++;
    if (this.seqIndex >= total) {
      this.seqIndex = 0;
      this.level += 1;
    }

    if (idx === 0) {
      // Entry segment: START_DEF on level 1, EASY pool pick otherwise.
      return { kind: 'fortress', def: this.level === 1 ? START_DEF : FORTRESS_POOL[0] };
    }
    if (idx === fortressCount - 1) {
      return { kind: 'fortress', def: GATE_DEF };
    }
    if (idx < fortressCount) {
      return { kind: 'fortress', def: this.pickFortress() };
    }
    return { kind: 'space' };
  }
}
