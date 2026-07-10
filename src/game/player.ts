import * as THREE from 'three';
import { clone } from '../core/assets';
import { SHIP } from '../config';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class Player {
  mesh: THREE.Group;
  x = 0;
  y = 1.5;
  private roll = 0;
  private pitch = 0;

  private shadow: THREE.Mesh;
  private line: THREE.Line;
  private lineGeo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    this.mesh = clone('ship');
    this.mesh.position.set(0, this.y, 0);
    scene.add(this.mesh);

    const shadowGeo = new THREE.CircleGeometry(0.55, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0, 0.03, 0);
    scene.add(this.shadow);

    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.5 });
    this.line = new THREE.Line(this.lineGeo, lineMat);
    scene.add(this.line);
  }

  update(dt: number, inputX: number, inputY: number): void {
    this.x = clamp(this.x + inputX * SHIP.LATERAL_SPEED * dt, -SHIP.CLAMP_X, SHIP.CLAMP_X);
    this.y = clamp(this.y + inputY * SHIP.VERTICAL_SPEED * dt, SHIP.MIN_Y, SHIP.MAX_Y);

    const targetRoll = -inputX * SHIP.BANK_MAX;
    const targetPitch = inputY * SHIP.PITCH_MAX;
    const k = Math.min(1, SHIP.TILT_LERP * dt);
    this.roll += (targetRoll - this.roll) * k;
    this.pitch += (targetPitch - this.pitch) * k;

    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.rotation.z = this.roll;
    this.mesh.rotation.x = this.pitch;

    this.shadow.position.set(this.x, 0.03, 0);

    const pos = this.lineGeo.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, this.x, 0.05, 0);
    pos.setXYZ(1, this.x, this.y - 0.25, 0);
    pos.needsUpdate = true;
  }

  setShadowVisible(v: boolean): void {
    this.shadow.visible = v;
    this.line.visible = v;
  }

  setBlink(t: number | null): void {
    this.mesh.visible = t === null ? true : Math.floor(t * 10) % 2 === 0;
  }

  reset(): void {
    this.x = 0;
    this.y = 1.5;
    this.roll = 0;
    this.pitch = 0;
    this.mesh.position.set(0, this.y, 0);
    this.mesh.rotation.set(0, this.mesh.rotation.y, 0);
    this.mesh.visible = true;
  }

  nosePos(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: -0.7 };
  }
}
