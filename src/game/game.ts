import * as THREE from 'three';
import {
  SHIP, FUEL, COMBAT, GAME, POINTS, scrollSpeed,
} from '../config';
import * as input from '../core/input';
import type { World } from './world';
import type { Director } from './director';
import type { Player } from './player';
import type { Bullets } from './bullets';
import type { Aircraft } from './aircraft';
import type { Fx } from './fx';
import type { Hud } from './hud';
import type { Audio } from './audio';
import { collidersNear, pointHits, boxOverlap } from './collision';
import { updateTurrets } from './turrets';
import { CRAFT_HALF } from './aircraft';
import type { Collider } from '../types';

type State = 'title' | 'playing' | 'dying' | 'gameover';

export class Game {
  private state: State = 'title';
  private dist = 0;
  private score = 0;
  private hiscore = Number(localStorage.getItem('haxxon.hiscore') || 0);
  private lives = GAME.START_LIVES;
  private fuel = FUEL.MAX;
  private fireCd = 0;
  private invulnT = 0;
  private deathT = 0;
  private paused = false;
  private lowFuelBeepT = 0;

  constructor(
    private scene: THREE.Scene,
    private world: World,
    private director: Director,
    private player: Player,
    private bullets: Bullets,
    private aircraft: Aircraft,
    private fx: Fx,
    private hud: Hud,
    private audio: Audio,
  ) {}

  showTitle(): void {
    this.hud.setTitleHiScore(this.hiscore);
    this.hud.setHiScore(this.hiscore);
    this.hud.show('title');
    this.hud.hide('hud');
    this.state = 'title';
    this.dist = 0;
    this.world.ensure(0);
  }

  update(dt: number): void {
    // Global keys (any state).
    if (input.consume('KeyM')) {
      const muted = this.audio.toggleMute();
      this.hud.flash(muted ? 'MUTED' : 'SOUND ON');
    }
    if (input.consume('KeyI')) {
      const inv = input.toggleInvert();
      this.hud.flash(inv ? 'INVERT ON' : 'INVERT OFF');
    }

    switch (this.state) {
      case 'title': this.updateTitle(dt); break;
      case 'playing': this.updatePlaying(dt); break;
      case 'dying': this.updateDying(dt); break;
      case 'gameover': this.updateGameOver(dt); break;
    }
  }

  private updateTitle(dt: number): void {
    this.dist += GAME.ATTRACT_SCROLL * dt;
    this.world.ensure(this.dist);
    this.world.updateSpinners(dt);
    if (input.consume('Space')) this.startRun();
  }

  private updateGameOver(dt: number): void {
    this.fx.update(dt);
    if (input.consume('KeyR')) this.startRun();
  }

  private updateDying(dt: number): void {
    this.fx.update(dt);
    this.deathT -= dt;
    if (this.deathT <= 0) {
      if (this.lives > 0) {
        this.state = 'playing';
        this.fuel = FUEL.MAX;
        this.invulnT = GAME.INVULN;
        this.player.mesh.visible = true;
      } else {
        this.gameOver();
      }
    }
  }

  private updatePlaying(dt: number): void {
    if (input.consume('KeyP')) {
      this.paused = !this.paused;
      if (this.paused) this.hud.show('paused'); else this.hud.hide('paused');
    }
    if (this.paused) return;

    const level = this.director.level;
    const speed = scrollSpeed(level);
    this.dist += speed * dt;
    this.world.ensure(this.dist);
    this.world.updateSpinners(dt);

    const seg = this.world.segmentAt(this.dist);
    const inSpace = seg?.kind === 'space';
    this.hud.setLevel(level);

    this.player.update(dt, input.moveX(), input.moveY());
    this.player.setShadowVisible(!inSpace);

    if (this.invulnT > 0) {
      this.invulnT -= dt;
      this.player.setBlink(this.invulnT > 0 ? this.invulnT : null);
    }

    // Fire.
    this.fireCd -= dt;
    if (input.fireHeld() && this.fireCd <= 0) {
      const nose = this.player.nosePos();
      this.bullets.firePlayer(nose.x, nose.y, nose.z);
      this.audio.laser();
      this.fireCd = COMBAT.FIRE_COOLDOWN;
    }

    this.bullets.update(dt);
    if (this.aircraft.update(dt, inSpace, level, speed)) this.audio.flyby();
    updateTurrets(dt, this.dist, this.world, this.player.x, this.player.y, level,
      this.invulnT <= 0, (fx, fy, fz, tx, ty, tz) => this.bullets.fireEnemy(fx, fy, fz, tx, ty, tz));
    this.fx.update(dt);

    // Fuel.
    this.fuel -= FUEL.DRAIN * dt;
    this.hud.setFuel(this.fuel / FUEL.MAX);
    if (this.fuel < FUEL.LOW) {
      this.lowFuelBeepT -= dt;
      if (this.lowFuelBeepT <= 0) { this.audio.lowFuel(); this.lowFuelBeepT = 1; }
    }
    if (this.fuel <= 0) { this.die(); return; }

    this.hud.setAltitude((this.player.y - SHIP.MIN_Y) / (SHIP.MAX_Y - SHIP.MIN_Y));

    this.handlePlayerBullets();
    if (this.invulnT <= 0) this.handleShipCollisions();
  }

  private handlePlayerBullets(): void {
    this.bullets.forEachActivePlayer((b) => {
      const bx = b.mesh.position.x;
      const by = b.mesh.position.y;
      const u = this.dist - b.mesh.position.z;

      // vs world colliders
      for (const c of collidersNear(this.world.segments, u - 1, u + 1)) {
        if (!pointHits(bx, by, u, c, COMBAT.HIT_INFLATE)) continue;
        if (c.hp > 0) {
          c.hp -= 1;
          if (c.hp <= 0) {
            this.world.destroyCollider(c);
            this.addScore(c.points);
            if (c.fuel > 0) {
              this.fuel = Math.min(FUEL.MAX, this.fuel + c.fuel);
              this.audio.refuel();
              this.hud.flash('FUEL +' + c.fuel);
            } else {
              this.audio.hit();
            }
            this.fx.explode(this.sceneCenterOf(c), false);
          } else {
            this.audio.hit();
          }
        } else {
          this.audio.hit();
        }
        this.bullets.deactivatePlayer(b);
        return;
      }

      // vs aircraft
      for (const c of this.aircraft.list) {
        if (Math.abs(bx - c.mesh.position.x) < CRAFT_HALF.x + 0.1
            && Math.abs(by - c.mesh.position.y) < CRAFT_HALF.y + 0.2
            && Math.abs(b.mesh.position.z - c.mesh.position.z) < CRAFT_HALF.z + 0.1) {
          this.fx.explode(c.mesh.position, false);
          this.addScore(POINTS.AIRCRAFT);
          this.audio.explosion();
          this.aircraft.removeCraft(c);
          this.bullets.deactivatePlayer(b);
          return;
        }
      }
    });
  }

  private handleShipCollisions(): void {
    const px = this.player.x;
    const py = this.player.y;

    // Ground is a floor, not a hazard: altitude is clamped at SHIP.MIN_Y in Player.update,
    // so the ship simply can't fly lower. Only walls/props/enemies are lethal.

    // World AABB.
    const aMinX = px - SHIP.HALF.x, aMaxX = px + SHIP.HALF.x;
    const aMinY = py - SHIP.HALF.y, aMaxY = py + SHIP.HALF.y;
    const aMinU = this.dist - SHIP.HALF.z, aMaxU = this.dist + SHIP.HALF.z;
    for (const c of collidersNear(this.world.segments, this.dist - 2, this.dist + 2)) {
      if (boxOverlap(aMinX, aMaxX, aMinY, aMaxY, aMinU, aMaxU, c)) { this.die(); return; }
    }

    // Aircraft (scene space; ship at z=0).
    for (const c of this.aircraft.list) {
      if (Math.abs(px - c.mesh.position.x) < SHIP.HALF.x + CRAFT_HALF.x
          && Math.abs(py - c.mesh.position.y) < SHIP.HALF.y + CRAFT_HALF.y
          && Math.abs(0 - c.mesh.position.z) < SHIP.HALF.z + CRAFT_HALF.z) {
        this.fx.explode(c.mesh.position, false);
        this.aircraft.removeCraft(c);
        this.die();
        return;
      }
    }

    // Enemy bullets.
    let hit = false;
    this.bullets.forEachActiveEnemy((b) => {
      if (hit) return;
      const p = b.mesh.position;
      if (p.x > aMinX - 0.1 && p.x < aMaxX + 0.1
          && p.y > aMinY - 0.1 && p.y < aMaxY + 0.1
          && p.z > -SHIP.HALF.z - 0.1 && p.z < SHIP.HALF.z + 0.1) {
        hit = true;
        this.bullets.deactivateEnemy(b);
      }
    });
    if (hit) { this.die(); return; }
  }

  private sceneCenterOf(c: Collider): { x: number; y: number; z: number } {
    return {
      x: (c.minX + c.maxX) / 2,
      y: (c.minY + c.maxY) / 2,
      z: this.dist - (c.minU + c.maxU) / 2,
    };
  }

  private addScore(n: number): void {
    this.score += n;
    this.hud.setScore(this.score);
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      localStorage.setItem('haxxon.hiscore', String(this.hiscore));
      this.hud.setHiScore(this.hiscore);
    }
  }

  private die(): void {
    this.audio.explosion();
    this.fx.explode(this.player.mesh.position, true);
    this.lives -= 1;
    this.hud.setLives(this.lives);
    this.player.mesh.visible = false;
    this.state = 'dying';
    this.deathT = GAME.DEATH_PAUSE;
  }

  private startRun(): void {
    this.world.clear();
    this.director.reset();
    this.bullets.clearAll();
    this.aircraft.clearAll();
    this.fx.clear();
    this.dist = 0;
    this.world.ensure(this.dist);
    this.score = 0;
    this.lives = GAME.START_LIVES;
    this.fuel = FUEL.MAX;
    this.invulnT = 0;
    this.fireCd = 0;
    this.paused = false;
    this.player.reset();

    this.hud.hide('title');
    this.hud.hide('gameover');
    this.hud.hide('paused');
    this.hud.show('hud');
    this.hud.setScore(0);
    this.hud.setHiScore(this.hiscore);
    this.hud.setLives(this.lives);
    this.hud.setLevel(this.director.level);
    this.hud.setFuel(1);
    this.hud.setAltitude((this.player.y - SHIP.MIN_Y) / (SHIP.MAX_Y - SHIP.MIN_Y));

    this.state = 'playing';
  }

  private gameOver(): void {
    this.audio.gameOver();
    this.hud.setGameOver(this.score, this.hiscore, this.score === this.hiscore && this.score > 0);
    this.hud.show('gameover');
    this.state = 'gameover';
  }
}
